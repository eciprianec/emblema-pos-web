from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import httpx
from ..database import get_db
from ..models import Sale, SaleItem, Product, Client, CreditMovement, StockMovement, CashSession, DGIIConfig, User, StoreSettings
from ..schemas import SaleCreateRequest, SaleOut
from ..auth import get_current_user

router = APIRouter(prefix="/ventas", tags=["ventas"])

@router.get("/lookup")
@router.get("/buscar-producto")
def lookup_product(
    query: Optional[str] = None, 
    q: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    """
    Búsqueda rápida para lector de código de barras o teclado en la terminal de venta F1
    """
    clean_q = (query or q or "").strip()
    if not clean_q:
        return []
    
    # 1. Búsqueda exacta por código de barras
    exact = db.query(Product).filter(Product.barcode == clean_q, Product.is_active == True).first()
    if exact:
        return [format_pos_product(exact)]
        
    # 2. Búsqueda por nombre o SKU
    results = db.query(Product).filter(
        (Product.name.ilike(f"%{clean_q}%")) | (Product.sku.ilike(f"%{clean_q}%")),
        Product.is_active == True
    ).limit(15).all()
    
    return [format_pos_product(p) for p in results]

def format_pos_product(p: Product):
    return {
        "id": p.id,
        "barcode": p.barcode,
        "sku": p.sku,
        "name": p.name,
        "sell_type": p.sell_type, # 'unit', 'bulk', 'package'
        "sale_price": p.sale_price,
        "cost_price": p.cost_price,
        "tax_rate": p.tax_rate,
        "stock": p.stock,
        "wholesale_price": p.wholesale_price,
        "wholesale_quantity": p.wholesale_quantity,
        "department_name": p.department.name if p.department else "General"
    }

@router.get("/price-check/{barcode}")
@router.get("/verificador-precio")
def price_check(
    barcode: Optional[str] = None, 
    q: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    """
    F3: Verificador de Precios
    """
    term = (barcode or q or "").strip()
    product = db.query(Product).filter(
        (Product.barcode == term) | (Product.name.ilike(f"%{term}%")), 
        Product.is_active == True
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado en catálogo")
        
    return {
        "id": product.id,
        "barcode": product.barcode,
        "name": product.name,
        "sale_price": product.sale_price,
        "tax_rate": product.tax_rate,
        "stock": product.stock,
        "wholesale_price": product.wholesale_price,
        "wholesale_quantity": product.wholesale_quantity,
        "sell_type": product.sell_type
    }

@router.post("/sale")
@router.post("")
@router.post("/")
def process_sale(
    sale: SaleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Procesar venta: descuenta stock, asigna e-NCF, timbra con DGII, registra crédito si aplica
    """
    if not sale.items:
        raise HTTPException(status_code=400, detail="El ticket de venta está vacío")
        
    # Verificar sesión de caja abierta
    session = db.query(CashSession).filter(
        CashSession.cashier_id == current_user.id,
        CashSession.status == "open"
    ).order_by(CashSession.opened_at.desc()).first()
    
    # Obtener configuración DGII para secuencias e-NCF
    dgii_cfg = db.query(DGIIConfig).first()
    if not dgii_cfg:
        dgii_cfg = DGIIConfig(secuencia_e31_actual=1, secuencia_e32_actual=1)
        db.add(dgii_cfg)
        db.commit()
        db.refresh(dgii_cfg)
        
    # Asignar secuencia oficial e-NCF
    if sale.ncf_type == "E31":
        seq_num = dgii_cfg.secuencia_e31_actual
        encf = f"E31{seq_num:010d}"
        dgii_cfg.secuencia_e31_actual += 1
    else:
        seq_num = dgii_cfg.secuencia_e32_actual
        encf = f"E32{seq_num:010d}"
        dgii_cfg.secuencia_e32_actual += 1
        
    # Configuración de tienda para comportamiento de venta
    store_settings = db.query(StoreSettings).first()
    allow_negative = store_settings.allow_sales_without_stock if store_settings else True
    tax_included = store_settings.prices_include_tax if store_settings else True
    
    # Validar existencias si no se permite inventario negativo
    if not allow_negative:
        for item in sale.items:
            prod_chk = None
            if item.product_id:
                prod_chk = db.query(Product).filter(Product.id == item.product_id).first()
            elif item.barcode:
                prod_chk = db.query(Product).filter(Product.barcode == item.barcode).first()
            if prod_chk and prod_chk.stock < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para '{prod_chk.name}'. Existencia actual: {prod_chk.stock}, solicitada: {item.quantity}"
                )

    # Cálculos
    subtotal = 0.0
    itbis_total = 0.0
    cost_total = 0.0
    processed_items = []
    
    for item in sale.items:
        prod = None
        if item.product_id:
            prod = db.query(Product).filter(Product.id == item.product_id).first()
        elif item.barcode:
            prod = db.query(Product).filter(Product.barcode == item.barcode).first()
            
        unit_price = item.unit_price
        
        # Aplicar mayoreo automático si cumple la cantidad
        if prod and prod.wholesale_price and prod.wholesale_quantity:
            if item.quantity >= prod.wholesale_quantity:
                unit_price = prod.wholesale_price
                
        tax_mult = item.tax_rate / 100.0
        if tax_included and item.tax_rate > 0:
            # El precio de venta ya incluye el ITBIS (Estándar Dominicano)
            line_gross = round(item.quantity * unit_price, 2)
            line_subtotal = round(line_gross / (1.0 + tax_mult), 2)
            line_tax = round(line_gross - line_subtotal, 2)
            line_total = line_gross
        else:
            line_subtotal = round(item.quantity * unit_price, 2)
            line_tax = round(line_subtotal * tax_mult, 2)
            line_total = round(line_subtotal + line_tax, 2)
            
        line_cost = (prod.cost_price if prod else 0.0) * item.quantity
        
        subtotal += line_subtotal
        itbis_total += line_tax
        cost_total += line_cost
        
        processed_items.append({
            "product_id": prod.id if prod else None,
            "name": item.name,
            "quantity": item.quantity,
            "unit_price": unit_price,
            "cost_price": prod.cost_price if prod else 0.0,
            "tax_rate": item.tax_rate,
            "subtotal": line_subtotal,
            "itbis": line_tax,
            "total": line_total
        })
        
    total = round(subtotal + itbis_total, 2)
    
    # Manejo de crédito ("El Fiado")
    client = None
    if sale.payment_method == "credit":
        if not sale.client_id:
            raise HTTPException(status_code=400, detail="Debe seleccionar un cliente para vender a crédito (El Fiado)")
        client = db.query(Client).filter(Client.id == sale.client_id, Client.is_active == True).first()
        if not client:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
            
        if (client.current_balance + total) > client.credit_limit:
            raise HTTPException(
                status_code=400, 
                detail=f"Límite de crédito excedido. Disponible: RD${max(0, client.credit_limit - client.current_balance):,.2f}"
            )
            
    # Registrar Venta
    new_sale = Sale(
        session_id=session.id if session else None,
        cashier_id=current_user.id,
        client_id=client.id if client else None,
        client_name=client.name if client else sale.client_name,
        client_rnc=client.rnc_cedula if client else sale.client_rnc,
        subtotal=round(subtotal, 2),
        itbis=round(itbis_total, 2),
        total=round(total, 2),
        cost_total=round(cost_total, 2),
        payment_method=sale.payment_method,
        cash_received=sale.cash_received if sale.payment_method == "cash" else total,
        cash_change=max(0.0, sale.cash_received - total) if sale.payment_method == "cash" else 0.0,
        ncf_type=sale.ncf_type,
        encf=encf,
        dgii_status="pending",
        created_at=datetime.utcnow()
    )
    db.add(new_sale)
    db.commit()
    db.refresh(new_sale)
    
    # Registrar Items y descontar stock
    for it in processed_items:
        sale_item = SaleItem(
            sale_id=new_sale.id,
            product_id=it["product_id"],
            name=it["name"],
            quantity=it["quantity"],
            unit_price=it["unit_price"],
            cost_price=it["cost_price"],
            tax_rate=it["tax_rate"],
            subtotal=it["subtotal"],
            itbis=it["itbis"],
            total=it["total"]
        )
        db.add(sale_item)
        
        if it["product_id"]:
            p = db.query(Product).filter(Product.id == it["product_id"]).first()
            if p:
                prev_stock = p.stock
                p.stock = max(0.0, p.stock - it["quantity"])
                mov = StockMovement(
                    product_id=p.id,
                    type="venta",
                    quantity=it["quantity"],
                    previous_stock=prev_stock,
                    new_stock=p.stock,
                    notes=f"Venta Ticket #{new_sale.id} ({encf})"
                )
                db.add(mov)
                
    # Si es crédito, registrar cargo a cliente
    if client:
        prev_bal = client.current_balance
        client.current_balance += total
        cr_mov = CreditMovement(
            client_id=client.id,
            sale_id=new_sale.id,
            type="cargo",
            amount=total,
            previous_balance=prev_bal,
            new_balance=client.current_balance,
            notes=f"Compra a crédito Ticket #{new_sale.id} ({encf})"
        )
        db.add(cr_mov)
        
    db.commit()
    
    # Timbrado electrónico con microservicio DGII e-CF
    track_id = None
    security_code = None
    if sale.send_to_dgii and dgii_cfg.auto_envio_dgii:
        try:
            dgii_payload = {
                "tipoEcf": "32" if sale.ncf_type == "E32" else "31",
                "encf": encf,
                "fechaVencimientoSecuencia": dgii_cfg.vencimiento_e32 if sale.ncf_type == "E32" else dgii_cfg.vencimiento_e31,
                "tipoPago": 1 if sale.payment_method == "cash" else 2,
                "comprador": {
                    "rnc": new_sale.client_rnc or "000000000",
                    "razonSocial": new_sale.client_name
                },
                "items": [
                    {
                        "nombre": it["name"],
                        "cantidad": it["quantity"],
                        "precioUnitario": it["unit_price"],
                        "tasaItbis": it["tax_rate"]
                    }
                    for it in processed_items
                ]
            }
            res = httpx.post(f"{dgii_cfg.service_url}/api/ecf/send", json=dgii_payload, timeout=2.5)
            if res.status_code == 200:
                data = res.json()
                track_id = data.get("trackId")
                security_code = data.get("securityCode")
                new_sale.ecf_track_id = track_id
                new_sale.security_code = security_code
                new_sale.dgii_status = "sent"
                db.commit()
        except Exception as e:
            print(f"Aviso timbrado e-CF: {e}")
            
    # Retornar recibo completo con datos tanto en la raíz como en ticket
    receipt_data = {
        "id": new_sale.id,
        "encf": encf,
        "ncf_type": sale.ncf_type,
        "client_name": new_sale.client_name,
        "client_rnc": new_sale.client_rnc,
        "subtotal": round(subtotal, 2),
        "itbis": round(itbis_total, 2),
        "total": round(total, 2),
        "payment_method": sale.payment_method,
        "cash_received": round(new_sale.cash_received, 2),
        "cash_change": round(new_sale.cash_change, 2),
        "created_at": new_sale.created_at.strftime("%Y-%m-%d %I:%M %p"),
        "date": new_sale.created_at.strftime("%Y-%m-%d %I:%M %p"),
        "cashier": current_user.full_name,
        "track_id": track_id,
        "security_code": security_code,
        "dgii_status": new_sale.dgii_status,
        "items": [
            {
                "name": it["name"],
                "quantity": it["quantity"],
                "unit_price": it["unit_price"],
                "total": round(it["total"], 2)
            }
            for it in processed_items
        ],
        "client_balance": round(client.current_balance, 2) if client else None
    }
    
    return {
        **receipt_data,
        "success": True,
        "message": "Venta completada",
        "ticket": receipt_data
    }

@router.get("/today")
@router.get("/historial")
def get_today_sales(db: Session = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    sales = db.query(Sale).filter(Sale.created_at >= today_start).order_by(Sale.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "encf": s.encf,
            "client_name": s.client_name,
            "total": s.total,
            "payment_method": s.payment_method,
            "status": s.status,
            "dgii_status": s.dgii_status,
            "time": s.created_at.strftime("%I:%M %p"),
            "items_count": len(s.items)
        }
        for s in sales
    ]

@router.post("/cancel/{sale_id}")
@router.post("/{sale_id}/cancelar")
def cancel_sale(
    sale_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancelación / Devolución de Venta
    """
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale.status == "cancelled":
        raise HTTPException(status_code=400, detail="Esta venta ya fue cancelada previamente")
        
    sale.status = "cancelled"
    
    # Devolver stock
    for item in sale.items:
        if item.product_id:
            p = db.query(Product).filter(Product.id == item.product_id).first()
            if p:
                prev = p.stock
                p.stock += item.quantity
                mov = StockMovement(
                    product_id=p.id,
                    type="entrada",
                    quantity=item.quantity,
                    previous_stock=prev,
                    new_stock=p.stock,
                    notes=f"Devolución / Cancelación de Venta #{sale.id} ({sale.encf})"
                )
                db.add(mov)
                
    # Si fue a crédito, reversar deuda del cliente
    if sale.payment_method == "credit" and sale.client_id:
        c = db.query(Client).filter(Client.id == sale.client_id).first()
        if c:
            prev_b = c.current_balance
            c.current_balance = max(0.0, c.current_balance - sale.total)
            cr_mov = CreditMovement(
                client_id=c.id,
                sale_id=sale.id,
                type="abono",
                amount=sale.total,
                previous_balance=prev_b,
                new_balance=c.current_balance,
                notes=f"Reversión por cancelación de Ticket #{sale.id}"
            )
            db.add(cr_mov)
            
    db.commit()
    return {"success": True, "message": f"Venta #{sale.id} ({sale.encf}) cancelada correctamente"}
