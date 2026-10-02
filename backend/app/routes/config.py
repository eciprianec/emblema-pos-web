import os
import shutil
import smtplib
import sqlite3
import datetime
from email.mime.text import MIMEText
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db, engine, ensure_schema_upgrades
from ..models import StoreSettings, User
from ..schemas import StoreSettingsUpdate, UserCreate, UserUpdate, UserOut
from ..auth import get_current_user, get_password_hash

router = APIRouter(prefix="/config", tags=["config"])

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "emblemapos.db"))

def get_or_create_store_settings(db: Session) -> StoreSettings:
    settings = db.query(StoreSettings).first()
    if not settings:
        settings = StoreSettings(
            store_name="Emblema POS",
            slogan="El mejor punto de venta para tu negocio",
            rnc="101010101",
            phone="809-555-0000",
            address="Av. 27 de Febrero #100, Santo Domingo, Rep. Dom.",
            email="contacto@ciberemblema.com",
            whatsapp="809-555-0000",
            currency_symbol="RD$",
            currency_name="Pesos Dominicanos",
            ticket_header="¡GRACIAS POR PREFERIRNOS!\nEsperamos servirle de nuevo pronto.",
            ticket_footer="Conserve este ticket para cualquier reclamo o garantía.\nNo se aceptan devoluciones después de 48 horas.",
            printer_width=80,
            printer_copies=1,
            auto_print_ticket=True,
            show_logo_on_ticket=True,
            show_cashier_on_ticket=True,
            show_tax_details=True,
            show_dgii_qr=True,
            font_size="normal",
            auto_open_drawer=True,
            drawer_on_cash_sale=True,
            drawer_on_movement=True,
            scale_enabled=False,
            scale_model="Torrey / Rhino",
            scale_port="COM1",
            barcode_scanner_beep=True,
            allow_sales_without_stock=True,
            warn_low_stock_on_sale=True,
            ask_confirm_delete_item=False,
            costing_method="last_cost",
            prices_include_tax=True,
            accept_cash=True,
            accept_card=True,
            accept_transfer=True,
            accept_credit=True,
            email_corte_notification=False,
            corte_notification_email="",
            smtp_host="",
            smtp_port=587,
            smtp_user="",
            smtp_password=""
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

def serialize_store_settings(settings: StoreSettings) -> dict:
    return {
        "id": settings.id,
        "store_name": settings.store_name,
        "slogan": settings.slogan,
        "rnc": settings.rnc,
        "phone": settings.phone,
        "address": settings.address,
        "email": settings.email or "",
        "whatsapp": settings.whatsapp or "",
        "currency_symbol": settings.currency_symbol or "RD$",
        "currency_name": settings.currency_name or "Pesos Dominicanos",
        "ticket_header": settings.ticket_header or "",
        "ticket_footer": settings.ticket_footer or "",
        "printer_width": settings.printer_width or 80,
        "printer_copies": settings.printer_copies or 1,
        "auto_print_ticket": bool(settings.auto_print_ticket),
        "show_logo_on_ticket": bool(settings.show_logo_on_ticket),
        "show_cashier_on_ticket": bool(settings.show_cashier_on_ticket),
        "show_tax_details": bool(settings.show_tax_details),
        "show_dgii_qr": bool(settings.show_dgii_qr),
        "font_size": settings.font_size or "normal",
        "auto_open_drawer": bool(settings.auto_open_drawer),
        "drawer_on_cash_sale": bool(settings.drawer_on_cash_sale),
        "drawer_on_movement": bool(settings.drawer_on_movement),
        "scale_enabled": bool(settings.scale_enabled),
        "scale_model": settings.scale_model or "Torrey / Rhino",
        "scale_port": settings.scale_port or "COM1",
        "barcode_scanner_beep": bool(settings.barcode_scanner_beep),
        "allow_sales_without_stock": bool(settings.allow_sales_without_stock),
        "warn_low_stock_on_sale": bool(settings.warn_low_stock_on_sale),
        "ask_confirm_delete_item": bool(settings.ask_confirm_delete_item),
        "costing_method": settings.costing_method or "last_cost",
        "prices_include_tax": bool(settings.prices_include_tax),
        "accept_cash": bool(settings.accept_cash),
        "accept_card": bool(settings.accept_card),
        "accept_transfer": bool(settings.accept_transfer),
        "accept_credit": bool(settings.accept_credit),
        "email_corte_notification": bool(settings.email_corte_notification),
        "corte_notification_email": settings.corte_notification_email or "",
        "smtp_host": settings.smtp_host or "",
        "smtp_port": settings.smtp_port or 587,
        "smtp_user": settings.smtp_user or "",
        "smtp_password": settings.smtp_password or "",
        "updated_at": settings.updated_at.isoformat() if settings.updated_at else None
    }

# ==========================================
# CONFIGURACIÓN GENERAL DEL NEGOCIO
# ==========================================
@router.get("/store")
def get_store_settings(db: Session = Depends(get_db)):
    """Obtiene la configuración completa del negocio, tickets, impresora y dispositivos"""
    settings = get_or_create_store_settings(db)
    return serialize_store_settings(settings)

@router.put("/store")
def update_store_settings(
    data: StoreSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualiza cualquier aspecto de la configuración del sistema"""
    settings = get_or_create_store_settings(db)
    update_data = data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if value is not None:
            setattr(settings, key, value)
            
    db.commit()
    db.refresh(settings)
    return {
        "message": "Configuración guardada exitosamente",
        "settings": serialize_store_settings(settings)
    }

# ==========================================
# GESTIÓN DE CAJEROS & PERMISOS
# ==========================================
@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista todos los cajeros y administradores con su matriz de permisos"""
    return db.query(User).all()

@router.post("/users", response_model=UserOut)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crea un nuevo cajero o administrador con permisos granulares"""
    existing = db.query(User).filter(
        (User.username == data.username) | (User.email == data.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="El nombre de usuario o correo ya está en uso")
        
    user = User(
        username=data.username,
        email=data.email,
        password=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role or "cajero",
        is_active=True,
        can_discount=data.can_discount if data.can_discount is not None else True,
        can_view_costs=data.can_view_costs if data.can_view_costs is not None else False,
        can_modify_inventory=data.can_modify_inventory if data.can_modify_inventory is not None else False,
        can_corte=data.can_corte if data.can_corte is not None else True,
        can_cancel_sales=data.can_cancel_sales if data.can_cancel_sales is not None else False,
        can_change_prices=data.can_change_prices if data.can_change_prices is not None else False,
        can_manage_clients=data.can_manage_clients if data.can_manage_clients is not None else True,
        can_view_reports=data.can_view_reports if data.can_view_reports is not None else False,
        can_access_config=data.can_access_config if data.can_access_config is not None else False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualiza los permisos y datos de un cajero o administrador"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        user.password = get_password_hash(update_data.pop("password"))
        
    for k, v in update_data.items():
        if v is not None:
            setattr(user, k, v)
            
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Elimina o da de baja a un cajero"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario en sesión activa")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    db.delete(user)
    db.commit()
    return {"message": f"Usuario '{user.username}' eliminado correctamente"}

# ==========================================
# RESPALDOS & MANTENIMIENTO DE BASE DE DATOS
# ==========================================
@router.get("/backup/download")
def download_backup(current_user: User = Depends(get_current_user)):
    """Descarga directa en 1-clic del archivo de base de datos SQLite (.db)"""
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="Archivo de base de datos no encontrado")
        
    filename = f"emblemapos_backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    return FileResponse(
        path=DB_PATH,
        filename=filename,
        media_type="application/octet-stream"
    )

@router.post("/backup/restore")
async def restore_backup(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Restaura una copia de seguridad cargando un archivo .db o .sqlite con verificación de integridad"""
    if not file.filename.endswith((".db", ".sqlite")):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .db o .sqlite")
        
    temp_path = f"{DB_PATH}.tmp_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    backup_copy = f"{DB_PATH}.bak_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # 1. Guardar temporalmente y verificar integridad SQLite
    test_conn = None
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        test_conn = sqlite3.connect(temp_path)
        cur = test_conn.cursor()
        cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table'")
        row = cur.fetchone()
        table_count = row[0] if row else 0
        test_conn.close()
        test_conn = None
        
        if table_count == 0:
            raise HTTPException(status_code=400, detail="El archivo proporcionado no contiene tablas válidas de base de datos")
    except HTTPException:
        if test_conn:
            try: test_conn.close()
            except Exception: pass
        if os.path.exists(temp_path):
            try: os.remove(temp_path)
            except Exception: pass
        raise
    except Exception as e:
        if test_conn:
            try: test_conn.close()
            except Exception: pass
        if os.path.exists(temp_path):
            try: os.remove(temp_path)
            except Exception: pass
        raise HTTPException(status_code=400, detail=f"El archivo cargado no es una base de datos válida: {str(e)}")
        
    # 2. Respaldar base actual y liberar conexiones SQLAlchemy
    try:
        engine.dispose()
        if os.path.exists(DB_PATH):
            shutil.copy2(DB_PATH, backup_copy)
            
        # 3. Aplicar nuevo archivo
        shutil.copy2(temp_path, DB_PATH)
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        # 4. Asegurar esquema actualizado
        ensure_schema_upgrades()
    except Exception as e:
        if os.path.exists(backup_copy):
            shutil.copy2(backup_copy, DB_PATH)
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Error al aplicar respaldo: {str(e)}")
        
    return {"message": "Base de datos restaurada y verificada exitosamente. Se ha aplicado el respaldo."}

@router.post("/database/optimize")
def optimize_database(current_user: User = Depends(get_current_user)):
    """Ejecuta VACUUM y REINDEX para optimizar índices y liberar espacio en disco"""
    try:
        with engine.connect() as conn:
            conn.execute(text("VACUUM"))
            conn.execute(text("REINDEX"))
            conn.commit()
            
        size_bytes = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
        size_kb = round(size_bytes / 1024, 2)
        return {
            "message": "Base de datos optimizada y compactada exitosamente (VACUUM & REINDEX ejecutados)",
            "size_kb": size_kb
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error optimizando base de datos: {str(e)}")

# ==========================================
# NOTIFICACIONES POR CORREO ELECTRÓNICO
# ==========================================
@router.post("/test-email")
def test_email(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verifica y envía un correo de prueba con la configuración SMTP actual"""
    settings = get_or_create_store_settings(db)
    if not settings.smtp_host or not settings.corte_notification_email:
        raise HTTPException(status_code=400, detail="Configure el servidor SMTP y el correo de destino antes de realizar la prueba")
        
    try:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port or 587, timeout=6)
        server.ehlo()
        server.starttls()
        server.ehlo()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
            
        msg = MIMEText(
            f"Saludos,\n\nEste es un mensaje de prueba generado desde Emblema POS Web ({settings.store_name}).\n"
            f"El envío automático de notificaciones de Corte de Turno (F6) está correctamente configurado.\n\n"
            f"Fecha y hora: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n"
            f"Usuario en sesión: {current_user.full_name} ({current_user.username})"
        )
        msg['Subject'] = f"Emblema POS Web - Notificación de Prueba [{settings.store_name}]"
        msg['From'] = settings.smtp_user or "pos@emblemapos.local"
        msg['To'] = settings.corte_notification_email
        
        server.send_message(msg)
        server.quit()
        return {"message": f"Correo de prueba enviado con éxito a {settings.corte_notification_email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo enviar el correo de prueba: {str(e)}")
