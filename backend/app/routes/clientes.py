from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from ..database import get_db
from ..models import Client, CreditMovement, User, CashSession, CashMovement
from ..schemas import ClientCreate, ClientOut, CreditPaymentRequest
from ..auth import get_current_user

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("", response_model=List[ClientOut])
def get_clients(
    search: Optional[str] = None,
    with_debt_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Client).filter(Client.is_active == True)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Client.name.ilike(search_filter)) |
            (Client.rnc_cedula.ilike(search_filter)) |
            (Client.phone.ilike(search_filter))
        )
        
    if with_debt_only:
        query = query.filter(Client.current_balance > 0)
        
    return query.order_by(Client.name.asc()).all()

@router.get("/summary/totals")
@router.get("/resumen-deuda/total")
def get_debt_summary(db: Session = Depends(get_db)):
    total_debt = db.query(func.sum(Client.current_balance)).filter(Client.is_active == True).scalar() or 0.0
    total_clients = db.query(func.count(Client.id)).filter(Client.is_active == True).scalar() or 0
    clients_with_debt = db.query(func.count(Client.id)).filter(Client.is_active == True, Client.current_balance > 0).scalar() or 0
    
    return {
        "total_debt": round(float(total_debt), 2),
        "total_clients": total_clients,
        "clients_with_debt": clients_with_debt,
        "clients_count": clients_with_debt
    }

@router.get("/{client_id}")
@router.get("/{client_id}/estado-cuenta")
def get_client_detail(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id, Client.is_active == True).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    movements = db.query(CreditMovement).filter(
        CreditMovement.client_id == client.id
    ).order_by(CreditMovement.created_at.desc()).limit(30).all()
    
    return {
        "client": {
            "id": client.id,
            "name": client.name,
            "rnc_cedula": client.rnc_cedula,
            "phone": client.phone,
            "email": client.email,
            "address": client.address,
            "credit_limit": client.credit_limit,
            "current_balance": round(client.current_balance, 2),
            "available_credit": max(0.0, round(client.credit_limit - client.current_balance, 2))
        },
        "movements": [
            {
                "id": m.id,
                "type": m.type,
                "amount": m.amount,
                "previous_balance": m.previous_balance,
                "new_balance": m.new_balance,
                "notes": m.notes,
                "date": m.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            for m in movements
        ]
    }

@router.post("", response_model=ClientOut)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_client = Client(
        name=payload.name,
        rnc_cedula=payload.rnc_cedula,
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        credit_limit=payload.credit_limit,
        current_balance=0.0
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client

@router.put("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    for key, val in payload.dict().items():
        setattr(client, key, val)
        
    db.commit()
    db.refresh(client)
    return client

@router.post("/{client_id}/abono")
def process_client_abono(
    client_id: int,
    payload: CreditPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Registra un abono o liquidación a la deuda de un cliente (El Fiado)
    """
    client = db.query(Client).filter(Client.id == client_id, Client.is_active == True).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto del abono debe ser mayor a 0")
        
    if client.current_balance <= 0:
        raise HTTPException(status_code=400, detail="El cliente no tiene saldo pendiente por pagar")
        
    try:
        previous_balance = client.current_balance
        new_balance = round(max(0.0, previous_balance - payload.amount), 2)
        
        # Actualizar balance
        client.current_balance = new_balance
        
        # Crear movimiento de crédito
        mov = CreditMovement(
            client_id=client.id,
            type="abono",
            amount=round(payload.amount, 2),
            previous_balance=round(previous_balance, 2),
            new_balance=new_balance,
            notes=payload.notes or f"Abono recibido por {current_user.full_name}"
        )
        db.add(mov)

        # Si el cajero tiene un turno de caja abierto, registrar entrada de efectivo en caja
        active_session = db.query(CashSession).filter(
            CashSession.cashier_id == current_user.id,
            CashSession.status == "open"
        ).order_by(CashSession.opened_at.desc()).first()

        if active_session:
            cash_entry = CashMovement(
                session_id=active_session.id,
                cashier_id=current_user.id,
                type="entrada",
                amount=round(payload.amount, 2),
                reason=f"Abono El Fiado - Cliente {client.name} (#{client.id})"
            )
            db.add(cash_entry)
            
        db.commit()
        db.refresh(mov)
        
        return {
            "success": True,
            "message": f"Abono de RD${payload.amount:,.2f} registrado exitosamente",
            "receipt": {
                "client_name": client.name,
                "rnc_cedula": client.rnc_cedula,
                "previous_balance": round(previous_balance, 2),
                "amount_paid": round(payload.amount, 2),
                "remaining_balance": round(new_balance, 2),
                "cashier": current_user.full_name,
                "date": mov.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al registrar abono: {str(e)}")

