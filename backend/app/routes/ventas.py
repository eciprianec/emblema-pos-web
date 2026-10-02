from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import httpx
from ..database import get_db
from ..models import Sale, SaleItem, Product, Client, CreditMovement, StockMovement, CashSession, DGIIConfig, User, StoreSettings
from ..schemas import SaleCreateRequest, SaleOut
from ..auth import get_current_user, require_permission

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
    
    # Configuración de tienda para comportamiento de venta
    store_settings = db.query(StoreSettings).first()
    allow_negative = store_settings.allow_sales_without_stock if store_settings else True
    tax_included = store_settings.prices_include_tax if store_settings else True
    
    # 1. Validar existencias si no se permite inventario negativo (ANTES de asignar secuencia)
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

    # 2. Cálculos de items y totales
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
        
        subtotal = round(subtotal + line_subtotal, 2)
        itbis_total = round(itbis_total + line_tax, 2)
        cost_total = round(cost_total + line_cost, 2)
        
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
    
    # 3. Desglose de Métodos de Pago (Multi-pago y compatibilidad Formato 607 DGII)
    pay_cash = 0.0
    pay_card = 0.0
    pay_transfer = 0.0
    pay_credit = 0.0
    
    if sale.payments:
        pay_cash = float(sale.payments.get("cash", 0.0))
        pay_card = float(sale.payments.get("card", 0.0))
        pay_transfer = float(sale.payments.get("transfer", 0.0))
        pay_credit = float(sale.payments.get("credit", 0.0))
    else:
        if sale.payment_method == "cash":
            pay_cash = total
        elif sale.payment_method == "card":
            pay_card = total
        elif sale.payment_method == "transfer":
            pay_transfer = total
        elif sale.payment_method == "credit":
            pay_credit = total
        else:
            pay_cash = total

    # 4. Manejo y validación de crédito ("El Fiado")
    client = None
    credit_amount_to_charge = pay_credit if sale.payments else (total if sale.payment_method == "credit" else 0.0)
    if credit_amount_to_charge > 0 or sale.payment_method == "credit":
        if not sale.client_id:
            raise HTTPException(status_code=400, detail="Debe seleccionar un cliente registrado para vender a crédito (El Fiado)")
        client = db.query(Client).filter(Client.id == sale.client_id, Client.is_active == True).first()
        if not client:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
            
        if (client.current_balance + credit_amount_to_charge) > client.credit_limit:
            raise HTTPException(
                status_code=400, 
                detail=f"Límite de crédito excedido. Disponible: RD${max(0.0, client.credit_limit - client.current_balance):,.2f}"
            )

    # 5. Reserva segura de e-NCF justo antes de escribir a la base de datos
    dgii_cfg = db.query(DGIIConfig).first()
    if not dgii_cfg:
        dgii_cfg = DGIIConfig(secuencia_e31_actual=1, secuencia_e32_actual=1)
        db.add(dgii_cfg)
        db.flush()

    if sale.ncf_type == "E31":
        seq_num = dgii_cfg.secuencia_e31_actual
        encf = f"E31{seq_num:010d}"
        dgii_cfg.secuencia_e31_actual += 1
    else:
        seq_num = dgii_cfg.secuencia_e32_actual
        encf = f"E32{seq_num:010d}"
        dgii_cfg.secuencia_e32_actual += 1

    cash_received_val = sale.cash_received if pay_cash > 0 else total
    cash_change_val = max(0.0, round(sale.cash_received - pay_cash, 2)) if pay_cash > 0 and sale.cash_received > pay_cash else 0.0

    # 6. Transacción Atómica Única (Sale + SaleItems + StockMovements + CreditMovement)
    try:
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
            payment_cash=round(pay_cash, 2),
            payment_card=round(pay_card, 2),
            payment_transfer=round(pay_transfer, 2),
            payment_credit=round(pay_credit, 2),
            cash_received=round(cash_received_val, 2),
            cash_change=round(cash_change_val, 2),
            ncf_type=sale.ncf_type,
            encf=encf,
            dgii_status="pending",
            created_at=datetime.utcnow()
        )
        db.add(new_sale)
        db.flush() # Genera new_sale.id sin hacer commit prematuro
        
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
                    # Si allow_negative es True, descuenta el stock real sin truncar erróneamente a cero
                    p.stock = round(p.stock - it["quantity"], 2) if allow_negative else max(0.0, round(p.stock - it["quantity"], 2))
                    mov = StockMovement(
                        product_id=p.id,
                        type="venta",
                        quantity=it["quantity"],
                        previous_stock=prev_stock,
                        new_stock=p.stock,
                        notes=f"Venta Ticket #{new_sale.id} ({encf})"
                    )
                    db.add(mov)
                    
        # Si hay monto a crédito, registrar cargo al cliente
        if client and credit_amount_to_charge > 0:
            prev_bal = client.current_balance
            client.current_balance = round(client.current_balance + credit_amount_to_charge, 2)
            cr_mov = CreditMovement(
                client_id=client.id,
                sale_id=new_sale.id,
                type="cargo",
                amount=credit_amount_to_charge,
                previous_balance=prev_bal,
                new_balance=client.current_balance,
                notes=f"Compra a crédito Ticket #{new_sale.id} ({encf})"
            )
            db.add(cr_mov)
            
        # Commit atómico único de todas las entidades
        db.commit()
        db.refresh(new_sale)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error transaccional al procesar la venta: {str(e)}")
    
    # 7. Timbrado electrónico con microservicio DGII e-CF
    track_id = None
    security_code = None
    if sale.send_to_dgii and dgii_cfg.auto_envio_dgii:
        try:
            # Determinación de forma de pago oficial DGII
            forma_pago_dgii = "01" # Efectivo por defecto
            if pay_credit > 0 or sale.payment_method == "credit":
                forma_pago_dgii = "04"
            elif pay_card > 0 or sale.payment_method == "card":
                forma_pago_dgii = "03"
            elif pay_transfer > 0 or sale.payment_method == "transfer":
                forma_pago_dgii = "02"
                
            dgii_payload = {
                "tipoEcf": "32" if sale.ncf_type == "E32" else "31",
                "encf": encf,
                "fechaVencimientoSecuencia": dgii_cfg.vencimiento_e32 if sale.ncf_type == "E32" else dgii_cfg.vencimiento_e31,
                "tipoPago": 1 if (sale.payment_method == "cash" and pay_credit == 0) else 2,
                "formaPago": forma_pago_dgii,
                "comprador": {
                    "rnc": new_sale.client_rnc or "000000000",
                    "razonSocial": new_sale.client_name
                },
                "items": [
                    {
                        "nombre": it["name"],
                        "cantidad": it["quantity"],
                        "precioUnitario": it["unit_price"],
                        "tasaItbis": it["tax_rate"],
                        "esBien": True
                    }
                    for it in processed_items
                ]
            }
            res = httpx.post(f"{dgii_cfg.service_url}/api/ecf/send", json=dgii_payload, timeout=3.5)
            if res.status_code == 200:
                data = res.json()
                track_id = data.get("trackId")
                security_code = data.get("codigoSeguridad") or data.get("securityCode")
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
        "payment_cash": round(pay_cash, 2),
        "payment_card": round(pay_card, 2),
        "payment_transfer": round(pay_transfer, 2),
        "payment_credit": round(pay_credit, 2),
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
    current_user: User = Depends(require_permission("can_cancel_sales"))
):
    """
    Cancelación / Devolución de Venta (Protegido por permiso can_cancel_sales)
    """
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale.status == "cancelled":
        raise HTTPException(status_code=400, detail="Esta venta ya fue cancelada previamente")
        
    try:
        sale.status = "cancelled"
        
        # Devolver stock
        for item in sale.items:
            if item.product_id:
                p = db.query(Product).filter(Product.id == item.product_id).first()
                if p:
                    prev = p.stock
                    p.stock = round(p.stock + item.quantity, 2)
                    mov = StockMovement(
                        product_id=p.id,
                        type="entrada",
                        quantity=item.quantity,
                        previous_stock=prev,
                        new_stock=p.stock,
                        notes=f"Devolución / Cancelación de Venta #{sale.id} ({sale.encf}) por {current_user.full_name}"
                    )
                    db.add(mov)
                    
        # Si hubo porción a crédito, reversar deuda del cliente
        credit_to_revert = sale.payment_credit if (sale.payment_credit and sale.payment_credit > 0) else (sale.total if sale.payment_method == "credit" else 0.0)
        if credit_to_revert > 0 and sale.client_id:
            c = db.query(Client).filter(Client.id == sale.client_id).first()
            if c:
                prev_b = c.current_balance
                c.current_balance = round(max(0.0, c.current_balance - credit_to_revert), 2)
                cr_mov = CreditMovement(
                    client_id=c.id,
                    sale_id=sale.id,
                    type="abono",
                    amount=credit_to_revert,
                    previous_balance=prev_b,
                    new_balance=c.current_balance,
                    notes=f"Reversión por cancelación de Ticket #{sale.id} ({sale.encf})"
                )
                db.add(cr_mov)
                
        db.commit()
        return {"success": True, "message": f"Venta #{sale.id} ({sale.encf}) cancelada y revertida correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al cancelar la venta: {str(e)}")

