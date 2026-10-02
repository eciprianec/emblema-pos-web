from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import datetime
import httpx
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from ..models import DGIIConfig, User, Sale
from ..schemas import DGIIConfigUpdate
from ..auth import get_current_user
from ..services.dgii_formatos import (
    build_606_report,
    build_607_report,
    convert_to_csv_606,
    convert_to_csv_607
)

router = APIRouter(prefix="/dgii", tags=["dgii"])

def get_or_create_dgii_config(db: Session) -> DGIIConfig:
    cfg = db.query(DGIIConfig).first()
    if not cfg:
        cfg = DGIIConfig(
            environment="DEV",
            service_url="http://localhost:3001",
            rnc_emisor="101010101",
            razon_social="Mi Empresa SRL",
            nombre_comercial="Emblema POS Web",
            direccion="Santo Domingo, República Dominicana",
            provincia="010000",
            municipio="010100",
            telefono="809-555-0000",
            email="facturacion@empresa.com",
            secuencia_e31_actual=1,
            secuencia_e31_fin=10000,
            secuencia_e32_actual=1,
            secuencia_e32_fin=50000
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg

@router.get("/config")
def get_dgii_config(db: Session = Depends(get_db)):
    cfg = get_or_create_dgii_config(db)
    
    # Intentar consultar salud del microservicio
    service_online = False
    try:
        res = httpx.get(f"{cfg.service_url}/health", timeout=1.5)
        service_online = res.status_code == 200
    except Exception:
        service_online = False
        
    return {
        "config": {
            "id": cfg.id,
            "environment": cfg.environment,
            "service_url": cfg.service_url,
            "rnc_emisor": cfg.rnc_emisor,
            "razon_social": cfg.razon_social,
            "nombre_comercial": cfg.nombre_comercial,
            "direccion": cfg.direccion,
            "provincia": cfg.provincia,
            "municipio": cfg.municipio,
            "telefono": cfg.telefono,
            "email": cfg.email,
            "cert_path": cfg.cert_path,
            "cert_configured": bool(cfg.cert_password),
            "cert_status": cfg.cert_status,
            "cert_expiry": cfg.cert_expiry,
            "secuencia_e31_actual": cfg.secuencia_e31_actual,
            "secuencia_e31_fin": cfg.secuencia_e31_fin,
            "vencimiento_e31": cfg.vencimiento_e31,
            "secuencia_e32_actual": cfg.secuencia_e32_actual,
            "secuencia_e32_fin": cfg.secuencia_e32_fin,
            "vencimiento_e32": cfg.vencimiento_e32,
            "auto_envio_dgii": cfg.auto_envio_dgii,
            "modo_contingencia": cfg.modo_contingencia
        },
        "service_online": service_online
    }

@router.put("/config")
@router.post("/config")
def update_dgii_config(
    payload: DGIIConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cfg = get_or_create_dgii_config(db)
    
    for key, val in payload.dict(exclude_unset=True).items():
        if val is not None:
            setattr(cfg, key, val)
            
    db.commit()
    db.refresh(cfg)
    
    # Sincronizar con microservicio si está encendido
    try:
        httpx.post(f"{cfg.service_url}/api/config", json={
            "dgii": {
                "environment": cfg.environment,
                "rncEmisor": cfg.rnc_emisor
            },
            "emisor": {
                "rnc": cfg.rnc_emisor,
                "razonSocial": cfg.razon_social,
                "nombreComercial": cfg.nombre_comercial,
                "direccion": cfg.direccion,
                "municipio": cfg.municipio,
                "provincia": cfg.provincia,
                "telefono": cfg.telefono,
                "email": cfg.email
            }
        }, timeout=2.0)
    except Exception as e:
        print(f"Aviso sync microservicio: {e}")
        
    return {"success": True, "message": "Configuración de DGII guardada exitosamente"}

@router.post("/test-connection")
@router.post("/test")
def test_dgii_connection(db: Session = Depends(get_db)):
    cfg = get_or_create_dgii_config(db)
    try:
        res = httpx.post(f"{cfg.service_url}/api/config/test-connection", timeout=3.0)
        return res.json()
    except Exception as e:
        return {
            "success": False,
            "serviceStatus": "OFFLINE",
            "message": f"No se pudo conectar con el microservicio en {cfg.service_url}. Verifique que el servicio esté iniciado."
        }

@router.post("/reintentar-envio/{sale_id}")
def retry_dgii_send(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cfg = get_or_create_dgii_config(db)
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
        
    try:
        dgii_payload = {
            "tipoEcf": "32" if sale.ncf_type == "E32" else "31",
            "encf": sale.encf,
            "fechaVencimientoSecuencia": cfg.vencimiento_e32 if sale.ncf_type == "E32" else cfg.vencimiento_e31,
            "tipoPago": 1 if sale.payment_method == "cash" else 2,
            "comprador": {
                "rnc": sale.client_rnc or "000000000",
                "razonSocial": sale.client_name
            },
            "items": [
                {
                    "nombre": it.name,
                    "cantidad": it.quantity,
                    "precioUnitario": it.unit_price,
                    "tasaItbis": it.tax_rate
                }
                for it in sale.items
            ]
        }
        res = httpx.post(f"{cfg.service_url}/api/ecf/send", json=dgii_payload, timeout=5.0)
        data = res.json()
        if res.status_code == 200:
            sale.ecf_track_id = data.get("trackId")
            sale.security_code = data.get("securityCode")
            sale.dgii_status = "sent"
            db.commit()
            return {"success": True, "message": "Comprobante e-CF enviado con éxito", "data": data}
        else:
            return {"success": False, "message": data.get("error", "Error timbrando e-CF"), "data": data}
    except Exception as e:
        return {"success": False, "message": f"Error de conexión con microservicio: {str(e)}"}

@router.get("/consultar-status/{track_id}")
def query_dgii_track_status(
    track_id: str,
    db: Session = Depends(get_db)
):
    cfg = get_or_create_dgii_config(db)
    try:
        res = httpx.get(f"{cfg.service_url}/api/ecf/status/{track_id}", timeout=5.0)
        return res.json()
    except Exception as e:
        return {"success": False, "error": f"Error consultando estatus: {str(e)}"}

@router.get("/logs")
def get_dgii_logs(
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sales = db.query(Sale).order_by(Sale.created_at.desc()).limit(limit).all()
    return [
        {
            "id": s.id,
            "encf": s.encf,
            "ncf_type": s.ncf_type,
            "client_name": s.client_name,
            "total": s.total,
            "status": s.dgii_status,
            "track_id": s.ecf_track_id,
            "security_code": s.security_code,
            "created_at": s.created_at.strftime("%Y-%m-%d %I:%M %p")
        }
        for s in sales
    ]

class CertUpload(BaseModel):
    filename: str
    base64_data: str
    password: str

@router.post("/certificate/upload")
def upload_certificate(
    payload: CertUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cfg = get_or_create_dgii_config(db)
    try:
        res = httpx.post(f"{cfg.service_url}/api/config/upload-certificate", json={
            "filename": payload.filename,
            "base64Data": payload.base64_data,
            "password": payload.password
        }, timeout=5.0)
        
        data = res.json()
        if res.status_code == 200 and data.get("success"):
            cfg.cert_password = payload.password
            cfg.cert_status = "vigente"
            if data.get("certificate", {}).get("validTo"):
                cfg.cert_expiry = str(data["certificate"]["validTo"])
            db.commit()
            return {"success": True, "message": "Certificado cargado y verificado", "data": data}
        else:
            raise HTTPException(status_code=400, detail=data.get("message", "Error validando certificado"))
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error comunicando con microservicio: {str(e)}")

@router.get("/sequences")
def get_sequences(db: Session = Depends(get_db)):
    cfg = get_or_create_dgii_config(db)
    e31_left = max(0, cfg.secuencia_e31_fin - cfg.secuencia_e31_actual)
    e32_left = max(0, cfg.secuencia_e32_fin - cfg.secuencia_e32_actual)
    
    return {
        "E31": {
            "name": "Factura de Crédito Fiscal (E31)",
            "prefix": "E31",
            "current": cfg.secuencia_e31_actual,
            "limit": cfg.secuencia_e31_fin,
            "remaining": e31_left,
            "expiry": cfg.vencimiento_e31,
            "is_low": e31_left < 100
        },
        "E32": {
            "name": "Factura de Consumo (E32)",
            "prefix": "E32",
            "current": cfg.secuencia_e32_actual,
            "limit": cfg.secuencia_e32_fin,
            "remaining": e32_left,
            "expiry": cfg.vencimiento_e32,
            "is_low": e32_left < 100
        }
    }

# ========================================================
# REPORTES Y FORMATOS OFICIALES DGII (606 & 607)
# ========================================================

@router.get("/formatos/resumen")
def get_formatos_resumen(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month
    
    rep_606 = build_606_report(db, y, m)
    rep_607 = build_607_report(db, y, m)
    
    return {
        "year": y,
        "month": m,
        "periodo": f"{y:04d}{m:02d}",
        "rnc_emisor": rep_606["rnc_emisor"],
        "compras_606": {
            "cantidad_registros": rep_606["cantidad_registros"],
            "totales": rep_606["totales"],
            "filename_txt": rep_606["filename_txt"],
            "filename_csv": rep_606["filename_csv"]
        },
        "ventas_607": {
            "cantidad_registros": rep_607["cantidad_registros"],
            "totales": rep_607["totales"],
            "filename_txt": rep_607["filename_txt"],
            "filename_csv": rep_607["filename_csv"]
        }
    }

@router.get("/formatos/606")
@router.get("/reportes/606")
def get_formato_606(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month
    return build_606_report(db, y, m)

@router.get("/formatos/606/download-txt")
def download_606_txt(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month
    rep = build_606_report(db, y, m)
    return Response(
        content=rep["txt_content"],
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{rep["filename_txt"]}"'}
    )

@router.get("/formatos/606/download-csv")
def download_606_csv(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month
    rep = build_606_report(db, y, m)
    csv_str = convert_to_csv_606(rep)
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{rep["filename_csv"]}"'}
    )

@router.get("/formatos/607")
@router.get("/reportes/607")
def get_formato_607(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month
    return build_607_report(db, y, m)

@router.get("/formatos/607/download-txt")
def download_607_txt(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month
    rep = build_607_report(db, y, m)
    return Response(
        content=rep["txt_content"],
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{rep["filename_txt"]}"'}
    )

@router.get("/formatos/607/download-csv")
def download_607_csv(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month
    rep = build_607_report(db, y, m)
    csv_str = convert_to_csv_607(rep)
    return Response(
        content=csv_str,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{rep["filename_csv"]}"'}
    )
