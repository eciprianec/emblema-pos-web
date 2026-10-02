from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import json
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from ..database import get_db
from ..models import CashSession, CashMovement, Sale, User, StoreSettings
from ..schemas import OpenSessionRequest, CloseSessionRequest, CashMovementRequest
from ..auth import get_current_user

router = APIRouter(prefix="/cortes", tags=["cortes"])

@router.get("/current")
@router.get("/estado-actual")
def get_current_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(CashSession).filter(
        CashSession.cashier_id == current_user.id,
        CashSession.status == "open"
    ).order_by(CashSession.opened_at.desc()).first()
    
    if not session:
        return {"is_open": False, "session": None}
        
    # Calcular movimientos de la sesión
    sales = db.query(Sale).filter(Sale.session_id == session.id, Sale.status == "completed").all()
    
    cash_sales = sum(s.total for s in sales if s.payment_method == "cash")
    card_sales = sum(s.total for s in sales if s.payment_method == "card")
    transfer_sales = sum(s.total for s in sales if s.payment_method == "transfer")
    credit_sales = sum(s.total for s in sales if s.payment_method == "credit")
    total_sales = sum(s.total for s in sales)
    
    movements = db.query(CashMovement).filter(CashMovement.session_id == session.id).all()
    cash_entries = sum(m.amount for m in movements if m.type == "entrada")
    cash_exits = sum(m.amount for m in movements if m.type == "salida")
    
    # Dinero que DEBERÍA haber en el cajón en efectivo
    expected_cash = session.initial_cash + cash_sales + cash_entries - cash_exits
    
    return {
        "is_open": True,
        "session": {
            "id": session.id,
            "cashier_name": current_user.full_name,
            "opened_at": session.opened_at.strftime("%Y-%m-%d %H:%M:%S"),
            "initial_cash": session.initial_cash,
            "notes": session.notes,
            "cash_sales": round(cash_sales, 2),
            "card_sales": round(card_sales, 2),
            "transfer_sales": round(transfer_sales, 2),
            "credit_sales": round(credit_sales, 2),
            "total_sales": round(total_sales, 2),
            "sales_count": len(sales),
            "cash_entries": round(cash_entries, 2),
            "cash_exits": round(cash_exits, 2),
            "expected_cash": round(expected_cash, 2)
        }
    }

@router.post("/open")
@router.post("/abrir")
def open_session(
    payload: OpenSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(CashSession).filter(
        CashSession.cashier_id == current_user.id,
        CashSession.status == "open"
    ).first()
    
    if existing:
        return {"message": "Ya tienes una sesión de caja abierta", "session_id": existing.id}
        
    session = CashSession(
        cashier_id=current_user.id,
        initial_cash=payload.initial_cash,
        status="open",
        notes=payload.notes or "",
        opened_at=datetime.utcnow()
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return {
        "success": True,
        "message": f"Caja abierta correctamente con fondo inicial de RD${payload.initial_cash:,.2f}",
        "session_id": session.id
    }

@router.post("/movement")
@router.post("/movimiento")
def add_cash_movement(
    payload: CashMovementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Registra Entrada de efectivo (F7) o Salida de efectivo (F8)
    """
    session = db.query(CashSession).filter(
        CashSession.cashier_id == current_user.id,
        CashSession.status == "open"
    ).first()
    
    if not session:
        raise HTTPException(status_code=400, detail="Debes abrir turno de caja antes de registrar movimientos")
        
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
        
    if payload.type not in ["entrada", "salida"]:
        raise HTTPException(status_code=400, detail="Tipo de movimiento inválido (use 'entrada' o 'salida')")
        
    mov = CashMovement(
        session_id=session.id,
        cashier_id=current_user.id,
        type=payload.type,
        amount=payload.amount,
        reason=payload.reason
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    
    tipo_str = "Entrada (F7)" if payload.type == "entrada" else "Salida (F8)"
    return {
        "success": True,
        "message": f"{tipo_str} de RD${payload.amount:,.2f} registrada: {payload.reason}",
        "movement": {
            "id": mov.id,
            "type": mov.type,
            "amount": mov.amount,
            "reason": mov.reason,
            "time": mov.created_at.strftime("%H:%M:%S")
        }
    }

@router.get("/movements")
def get_session_movements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(CashSession).filter(
        CashSession.cashier_id == current_user.id,
        CashSession.status == "open"
    ).first()
    
    if not session:
        return []
        
    movements = db.query(CashMovement).filter(
        CashMovement.session_id == session.id
    ).order_by(CashMovement.created_at.desc()).all()
    
    return [
        {
            "id": m.id,
            "type": m.type,
            "amount": m.amount,
            "reason": m.reason,
            "time": m.created_at.strftime("%I:%M %p")
        }
        for m in movements
    ]

@router.post("/close")
@router.post("/cerrar")
def close_session(
    payload: CloseSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cierre de Turno y Corte de Caja (F6):
    Compara dinero esperado con dinero contado y desglosa en ticket térmico
    """
    session = db.query(CashSession).filter(
        CashSession.cashier_id == current_user.id,
        CashSession.status == "open"
    ).first()
    
    if not session:
        raise HTTPException(status_code=400, detail="No hay turno de caja abierto para cerrar")
        
    # Calcular totales
    sales = db.query(Sale).filter(Sale.session_id == session.id, Sale.status == "completed").all()
    cash_sales = sum(s.total for s in sales if s.payment_method == "cash")
    card_sales = sum(s.total for s in sales if s.payment_method == "card")
    transfer_sales = sum(s.total for s in sales if s.payment_method == "transfer")
    credit_sales = sum(s.total for s in sales if s.payment_method == "credit")
    total_sales = sum(s.total for s in sales)
    
    # Ganancia estimada (ventas - costos)
    cost_total = sum(s.cost_total for s in sales)
    net_profit = max(0.0, total_sales - cost_total)
    
    movements = db.query(CashMovement).filter(CashMovement.session_id == session.id).all()
    cash_entries = sum(m.amount for m in movements if m.type == "entrada")
    cash_exits = sum(m.amount for m in movements if m.type == "salida")
    
    expected_cash = session.initial_cash + cash_sales + cash_entries - cash_exits
    counted_cash = float(payload.final_cash_counted)
    difference = counted_cash - expected_cash # positivo: sobrante, negativo: faltante
    
    session.status = "closed"
    session.closed_at = datetime.utcnow()
    session.final_cash_counted = counted_cash
    session.expected_cash = expected_cash
    session.difference = difference
    session.notes = payload.notes or ""
    session.bills_breakdown = json.dumps(payload.bills_breakdown or {})
    
    db.commit()
    
    # Enviar notificación automática por correo al dueño si está habilitado en StoreSettings
    store_settings = db.query(StoreSettings).first()
    if store_settings and store_settings.email_corte_notification and store_settings.corte_notification_email and store_settings.smtp_host:
        try:
            diff_label = "EXACTO" if abs(difference) < 0.01 else ("SOBRANTE" if difference > 0 else "FALTANTE")
            body_text = (
                f"CORTE DE CAJA / CIERRE DE TURNO - {store_settings.store_name}\n"
                f"========================================================\n"
                f"Cajero: {current_user.full_name} (@{current_user.username})\n"
                f"Apertura: {session.opened_at.strftime('%Y-%m-%d %I:%M %p')}\n"
                f"Cierre:   {session.closed_at.strftime('%Y-%m-%d %I:%M %p')}\n"
                f"--------------------------------------------------------\n"
                f"Fondo Inicial:     RD$ {session.initial_cash:,.2f}\n"
                f"Ventas Efectivo:   RD$ {cash_sales:,.2f}\n"
                f"Ventas Tarjeta:    RD$ {card_sales:,.2f}\n"
                f"Ventas Transf:     RD$ {transfer_sales:,.2f}\n"
                f"Ventas Crédito:    RD$ {credit_sales:,.2f}\n"
                f"TOTAL VENTAS:      RD$ {total_sales:,.2f} ({len(sales)} tickets)\n"
                f"--------------------------------------------------------\n"
                f"Entradas Caja (+): RD$ {cash_entries:,.2f}\n"
                f"Salidas Caja (-):  RD$ {cash_exits:,.2f}\n"
                f"Efectivo Esperado: RD$ {expected_cash:,.2f}\n"
                f"Efectivo Contado:  RD$ {counted_cash:,.2f}\n"
                f"Diferencia:        RD$ {difference:,.2f} ({diff_label})\n"
                f"Ganancia Estimada: RD$ {net_profit:,.2f}\n"
                f"========================================================\n"
                f"Notas del Cajero: {session.notes or 'Ninguna'}\n"
            )
            msg = MIMEText(body_text)
            msg['Subject'] = f"Corte de Caja - {store_settings.store_name} [{diff_label}: RD$ {difference:,.2f}]"
            msg['From'] = store_settings.smtp_user or "pos@emblemapos.local"
            msg['To'] = store_settings.corte_notification_email
            
            server = smtplib.SMTP(store_settings.smtp_host, store_settings.smtp_port or 587, timeout=5)
            server.ehlo()
            server.starttls()
            server.ehlo()
            if store_settings.smtp_user and store_settings.smtp_password:
                server.login(store_settings.smtp_user, store_settings.smtp_password)
            server.send_message(msg)
            server.quit()
        except Exception as mail_err:
            print(f"Aviso: no se pudo enviar correo de corte: {mail_err}")
    
    # Datos completos para imprimir el ticket de corte
    return {
        "success": True,
        "message": "Turno de caja cerrado exitosamente",
        "corte": {
            "session_id": session.id,
            "cashier": current_user.full_name,
            "opened_at": session.opened_at.strftime("%Y-%m-%d %I:%M %p"),
            "closed_at": session.closed_at.strftime("%Y-%m-%d %I:%M %p"),
            "initial_cash": round(session.initial_cash, 2),
            "cash_sales": round(cash_sales, 2),
            "card_sales": round(card_sales, 2),
            "transfer_sales": round(transfer_sales, 2),
            "credit_sales": round(credit_sales, 2),
            "total_sales": round(total_sales, 2),
            "sales_count": len(sales),
            "cash_entries": round(cash_entries, 2),
            "cash_exits": round(cash_exits, 2),
            "expected_cash": round(expected_cash, 2),
            "counted_cash": round(counted_cash, 2),
            "difference": round(difference, 2),
            "difference_status": "EXACTO" if abs(difference) < 0.01 else ("SOBRANTE" if difference > 0 else "FALTANTE"),
            "net_profit": round(net_profit, 2),
            "bills": payload.bills_breakdown or {}
        }
    }

@router.get("/history")
@router.get("/historial")
def get_cortes_history(
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(CashSession).filter(
        CashSession.status == "closed"
    ).order_by(CashSession.closed_at.desc()).limit(limit).all()
    
    return [
        {
            "id": s.id,
            "cashier_name": s.cashier.full_name if s.cashier else "N/A",
            "opened_at": s.opened_at.strftime("%Y-%m-%d %I:%M %p"),
            "closed_at": s.closed_at.strftime("%Y-%m-%d %I:%M %p") if s.closed_at else "Abierta",
            "initial_cash": s.initial_cash,
            "expected_cash": s.expected_cash,
            "counted_cash": s.final_cash_counted,
            "difference": s.difference,
            "notes": s.notes
        }
        for s in sessions
    ]
