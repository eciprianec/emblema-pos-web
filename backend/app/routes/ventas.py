import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional, List, Dict, Any
import httpx
from ..database import get_db, engine
from ..models import (
    Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem,
    Product, Client, CreditMovement, StockMovement, CashSession, DGIIConfig, User, StoreSettings
)
from ..schemas import SaleCreateRequest, SaleReturnRequest, SaleOut
from ..auth import get_current_user, require_permission

router = APIRouter(prefix="/ventas", tags=["ventas"])

# Mutex en memoria para garantizar asignación secuencial estrictamente atómica de e-NCF
SEQUENCE_LOCK = threading.Lock()

# Mapeo oficial DGII de métodos de pago a códigos numéricos (1 a 8)
DGII_PAYMENT_MAP = {
    "cash": 1,
    "efectivo": 1,
    "transfer": 2,
    "transferencia": 2,
    "check": 2,
    "cheque": 2,
    "card": 3,
    "tarjeta": 3,
    "tarjeta_debito": 3,
    "tarjeta_credito": 3,
    "credit": 4,
    "credito": 4,
    "gift_card": 5,
    "bono": 5,
    "bonos": 5,
    "swap": 6,
    "permuta": 6,
    "note": 7,
    "nota_credito": 7,
    "other": 8,
    "otro": 8,
    "otras": 8
}

def format_pos_product(p: Product):
    return {
        "id": p.id,
        "barcode": p.barcode,
        "sku": p.sku,
        "name": p.name,
        "sell_type": p.sell_type, # 'unit', 'bulk', 'package'
        "item_type": getattr(p, "item_type", "bien") or "bien",
        "sale_price": p.sale_price,
        "cost_price": p.cost_price,
        "tax_rate": p.tax_rate,
        "stock": p.stock,
        "wholesale_price": p.wholesale_price,
        "wholesale_quantity": p.wholesale_quantity,
        "department_name": p.department.name if p.department else "General"
    }

def format_sale_receipt(sale: Sale, cashier_name: str, client_balance: Optional[float] = None) -> Dict[str, Any]:
    """Helper unificado para generar el payload del recibo de venta y ticket F1"""
    receipt = {
        "id": sale.id,
        "encf": sale.encf,
        "ncf_type": sale.ncf_type,
        "client_name": sale.client_name,
        "client_rnc": sale.client_rnc,
        "subtotal": round(sale.subtotal, 2),
        "itbis": round(sale.itbis, 2),
        "total": round(sale.total, 2),
        "payment_method": sale.payment_method,
        "payment_cash": round(sale.payment_cash or 0.0, 2),
        "payment_card": round(sale.payment_card or 0.0, 2),
        "payment_transfer": round(sale.payment_transfer or 0.0, 2),
        "payment_credit": round(sale.payment_credit or 0.0, 2),
        "cash_received": round(sale.cash_received or 0.0, 2),
        "cash_change": round(sale.cash_change or 0.0, 2),
        "created_at": sale.created_at.strftime("%Y-%m-%d %I:%M %p") if sale.created_at else "",
        "date": sale.created_at.strftime("%Y-%m-%d %I:%M %p") if sale.created_at else "",
        "cashier": cashier_name,
        "track_id": sale.ecf_track_id,
        "security_code": sale.security_code,
        "dgii_status": sale.dgii_status,
        "fiscal_status": getattr(sale, "fiscal_status", "pending") or "pending",
        "idempotency_key": getattr(sale, "idempotency_key", None),
        "items": [
            {
                "id": it.id,
                "name": it.name,
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "total": round(it.total, 2),
                "item_type": getattr(it, "item_type", "bien") or "bien"
            }
            for it in (sale.items or [])
        ],
        "payments": [
            {
                "method": p.payment_method,
                "dgii_code": p.dgii_code,
                "amount": round(p.amount, 2),
                "reference": p.reference
            }
            for p in (getattr(sale, "payments", []) or [])
        ],
        "client_balance": client_balance
    }
    return {
        **receipt,
        "success": True,
        "message": "Venta completada",
        "ticket": receipt
    }

@router.get("/lookup")
@router.get("/buscar-producto")
def lookup_product(
    query: Optional[str] = None, 
    q: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    clean_q = (query or q or "").strip()
    if not clean_q:
        return []
    
    exact = db.query(Product).filter(Product.barcode == clean_q, Product.is_active == True).first()
    if exact:
        return [format_pos_product(exact)]
        
    results = db.query(Product).filter(
        (Product.name.ilike(f"%{clean_q}%")) | (Product.sku.ilike(f"%{clean_q}%")),
        Product.is_active == True
    ).limit(15).all()
    
    return [format_pos_product(p) for p in results]

@router.get("/price-check/{barcode}")
@router.get("/verificador-precio")
def price_check(
    barcode: Optional[str] = None, 
    q: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    term = (barcode or q or "").strip()
    product = db.query(Product).filter(
        (Product.barcode == term) | (Product.name.ilike(f"%{term}%")), 
        Product.is_active == True
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado en catálogo")
        
    return format_pos_product(product)

@router.post("/sale")
@router.post("")
@router.post("/")
def process_sale(
    sale: SaleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Procesar venta con soporte para:
    1. Idempotencia en backend (idempotency_key)
    2. Concurrencia atómica de secuencias e-NCF (Mutex thread-safe)
    3. Modelo de pagos normalizado (SalePayment) y columnas de compatibilidad
    4. Clasificación fiscal por producto (IndicadorBienoServicio 1 o 2)
    5. Desacoplamiento de estado comercial y fiscal con preservación de XML y tolerancia a timeouts
    """
    # 0. Validación de idempotencia: si la venta ya se procesó con esta clave, retornar recibo idéntico
    if sale.idempotency_key:
        existing_sale = db.query(Sale).filter(Sale.idempotency_key == sale.idempotency_key).first()
        if existing_sale:
            c_bal = existing_sale.client.current_balance if existing_sale.client else None
            cashier_name = existing_sale.cashier.full_name if existing_sale.cashier else current_user.full_name
            res = format_sale_receipt(existing_sale, cashier_name, c_bal)
            res["idempotent_cached"] = True
            return res

    if not sale.items:
        raise HTTPException(status_code=400, detail="El ticket de venta está vacío")
        
    # Verificar sesión de caja abierta
    session = db.query(CashSession).filter(
        CashSession.cashier_id == current_user.id,
        CashSession.status == "open"
    ).order_by(CashSession.opened_at.desc()).first()
    
    store_settings = db.query(StoreSettings).first()
    allow_negative = store_settings.allow_sales_without_stock if store_settings else True
    tax_included = store_settings.prices_include_tax if store_settings else True
    
    # 1. Validar existencias si no se permite inventario negativo
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
        
        # Mayoreo automático
        if prod and prod.wholesale_price and prod.wholesale_quantity:
            if item.quantity >= prod.wholesale_quantity:
                unit_price = prod.wholesale_price
                
        tax_mult = item.tax_rate / 100.0
        if tax_included and item.tax_rate > 0:
            line_gross = round(item.quantity * unit_price, 2)
            line_subtotal = round(line_gross / (1.0 + tax_mult), 2)
            line_tax = round(line_gross - line_subtotal, 2)
            line_total = line_gross
        else:
            line_subtotal = round(item.quantity * unit_price, 2)
            line_tax = round(line_subtotal * tax_mult, 2)
            line_total = round(line_subtotal + line_tax, 2)
            
        line_cost = (prod.cost_price if prod else 0.0) * item.quantity
        item_classification = getattr(item, "item_type", None) or (prod.item_type if prod and prod.item_type else "bien")
        
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
            "total": line_total,
            "item_type": item_classification
        })
        
    total = round(subtotal + itbis_total, 2)
    
    # 3. Procesamiento y Normalización de Pagos (Opción B)
    # Construcción de la lista de pagos para sale_payments y columnas resumen
    payment_records = [] # (payment_method, dgii_code, amount, reference)
    pay_cash = 0.0
    pay_card = 0.0
    pay_transfer = 0.0
    pay_credit = 0.0

    if sale.payment_details and len(sale.payment_details) > 0:
        for p in sale.payment_details:
            amt = float(p.amount)
            m_code = p.dgii_code or DGII_PAYMENT_MAP.get(p.payment_method.lower(), 1)
            payment_records.append({
                "method": p.payment_method.lower(),
                "dgii_code": m_code,
                "amount": amt,
                "reference": p.reference
            })
            if m_code == 1:
                pay_cash = round(pay_cash + amt, 2)
            elif m_code == 2:
                pay_transfer = round(pay_transfer + amt, 2)
            elif m_code == 3:
                pay_card = round(pay_card + amt, 2)
            elif m_code == 4:
                pay_credit = round(pay_credit + amt, 2)
            else:
                pay_cash = round(pay_cash + amt, 2)
    elif sale.payments:
        for method_key, amt_val in sale.payments.items():
            amt = float(amt_val)
            if amt > 0:
                m_code = DGII_PAYMENT_MAP.get(method_key.lower(), 1)
                payment_records.append({
                    "method": method_key.lower(),
                    "dgii_code": m_code,
                    "amount": amt,
                    "reference": None
                })
                if method_key == "cash":
                    pay_cash = round(pay_cash + amt, 2)
                elif method_key == "card":
                    pay_card = round(pay_card + amt, 2)
                elif method_key == "transfer":
                    pay_transfer = round(pay_transfer + amt, 2)
                elif method_key == "credit":
                    pay_credit = round(pay_credit + amt, 2)
    else:
        # Pago simple legacy
        m = sale.payment_method.lower()
        m_code = DGII_PAYMENT_MAP.get(m, 1)
        payment_records.append({
            "method": m,
            "dgii_code": m_code,
            "amount": total,
            "reference": None
        })
        if m == "cash":
            pay_cash = total
        elif m == "card":
            pay_card = total
        elif m == "transfer":
            pay_transfer = total
        elif m == "credit":
            pay_credit = total
        else:
            pay_cash = total

    # 4. Manejo y validación de crédito ("El Fiado")
    client = None
    credit_amount_to_charge = pay_credit
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

    # 5. Reserva segura y atómica de e-NCF protegida con Mutex y transacción dedicada en SQLite
    with SEQUENCE_LOCK:
        with engine.begin() as conn:
            cfg_row = conn.execute(text("SELECT id, secuencia_e31_actual, secuencia_e32_actual FROM dgii_config LIMIT 1")).fetchone()
            if not cfg_row:
                conn.execute(text("INSERT INTO dgii_config (secuencia_e31_actual, secuencia_e32_actual) VALUES (1, 1)"))
                cfg_id, s_e31, s_e32 = 1, 1, 1
            else:
                cfg_id, s_e31, s_e32 = cfg_row[0], cfg_row[1], cfg_row[2]

            if sale.ncf_type == "E31":
                seq_num = s_e31
                encf = f"E31{seq_num:010d}"
                conn.execute(text("UPDATE dgii_config SET secuencia_e31_actual = :nxt WHERE id = :cid"), {"nxt": s_e31 + 1, "cid": cfg_id})
            else:
                seq_num = s_e32
                encf = f"E32{seq_num:010d}"
                conn.execute(text("UPDATE dgii_config SET secuencia_e32_actual = :nxt WHERE id = :cid"), {"nxt": s_e32 + 1, "cid": cfg_id})

    cash_received_val = sale.cash_received if pay_cash > 0 else total
    cash_change_val = max(0.0, round(sale.cash_received - pay_cash, 2)) if pay_cash > 0 and sale.cash_received > pay_cash else 0.0

    # 6. Transacción Atómica Única (Sale + Items + Payments + StockMovements + CreditMovement)
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
            status="completed",
            dgii_status="pending",
            fiscal_status="pending",
            idempotency_key=sale.idempotency_key,
            created_at=datetime.utcnow()
        )
        db.add(new_sale)
        db.flush()
        
        # Guardar pagos normalizados en sale_payments
        for pr in payment_records:
            sp = SalePayment(
                sale_id=new_sale.id,
                payment_method=pr["method"],
                dgii_code=pr["dgii_code"],
                amount=round(pr["amount"], 2),
                reference=pr.get("reference"),
                created_at=datetime.utcnow()
            )
            db.add(sp)

        # Registrar Items y descontar stock
        for it in processed_items:
            sale_item = SaleItem(
                sale_id=new_sale.id,
                product_id=it["product_id"],
                name=it["name"],
                item_type=it["item_type"],
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
                pid = it["product_id"]
                qty = it["quantity"]
                # Descuento atómico en motor SQL para prevenir Lost Updates bajo concurrencia
                db.execute(
                    text("UPDATE products SET stock = stock - :qty WHERE id = :pid"),
                    {"qty": qty, "pid": pid}
                )
                cur_row = db.execute(text("SELECT stock FROM products WHERE id = :pid"), {"pid": pid}).fetchone()
                new_st = cur_row[0] if cur_row else 0.0
                prev_st = round(new_st + qty, 2)
                mov = StockMovement(
                    product_id=pid,
                    type="venta",
                    quantity=qty,
                    previous_stock=prev_st,
                    new_stock=new_st,
                    notes=f"Venta Ticket #{new_sale.id} ({encf})"
                )
                db.add(mov)
                    
        # Registrar movimiento de crédito al cliente si aplica
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
            
        # Confirmación comercial de la venta: los bienes ya fueron despachados y cobrados
        db.commit()
        db.refresh(new_sale)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error transaccional al procesar la venta: {str(e)}")
    
    # 7. Timbrado Electrónico con DGII e-CF (Tolerancia a Fallos y Desacoplamiento Fiscal)
    # Regla fiscal crítica: el estado comercial ya está guardado. Si DGII falla o hay timeout,
    # el e-NCF NO se reutiliza ni se destruye. Se guarda el XML generado y se marca como 'unknown'.
    dgii_cfg = db.query(DGIIConfig).first()
    if sale.send_to_dgii and dgii_cfg and dgii_cfg.auto_envio_dgii:
        try:
            formas_pago_dgii = [
                {
                    "formaPago": pr["dgii_code"],
                    "montoPago": round(pr["amount"], 2),
                    "referencia": pr.get("reference")
                }
                for pr in payment_records
            ]

            dgii_payload = {
                "tipoEcf": "32" if sale.ncf_type == "E32" else "31",
                "encf": encf,
                "fechaVencimientoSecuencia": dgii_cfg.vencimiento_e32 if sale.ncf_type == "E32" else dgii_cfg.vencimiento_e31,
                "tipoPago": 1 if (pay_credit == 0 and sale.payment_method != "credit") else 2,
                "formasPago": formas_pago_dgii,
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
                        "itemType": it["item_type"]
                    }
                    for it in processed_items
                ]
            }

            res = httpx.post(f"{dgii_cfg.service_url}/api/ecf/send", json=dgii_payload, timeout=2.5)
            data = res.json() if res.status_code in [200, 502, 500] else {}

            if res.status_code == 200 and data.get("success"):
                new_sale.ecf_track_id = data.get("trackId")
                new_sale.security_code = data.get("codigoSeguridad") or data.get("securityCode")
                new_sale.dgii_status = "sent"
                new_sale.fiscal_status = "accepted"
                new_sale.xml_content = data.get("xml")
                db.commit()
            else:
                new_sale.fiscal_status = "unknown"
                new_sale.fiscal_error = data.get("error", "Error reportado por microservicio DGII")
                if data.get("xml"):
                    new_sale.xml_content = data.get("xml")
                db.commit()

        except Exception as ecf_err:
            print(f"Aviso timbrado e-CF (red/timeout): {ecf_err}")
            new_sale.fiscal_status = "unknown"
            new_sale.fiscal_error = str(ecf_err)
            
            # Intento de respaldo del XML exacto en caso de timeout
            try:
                xml_res = httpx.post(f"{dgii_cfg.service_url}/api/ecf/generate-xml", json=dgii_payload, timeout=1.5)
                if xml_res.status_code == 200:
                    xml_data = xml_res.json()
                    new_sale.xml_content = xml_data.get("xml")
                    new_sale.security_code = xml_data.get("securityCode")
            except Exception:
                pass
            db.commit()

    c_bal = client.current_balance if client else None
    return format_sale_receipt(new_sale, current_user.full_name, c_bal)

@router.post("/reconciliar-dgii/{sale_id}")
@router.post("/{sale_id}/reconciliar-dgii")
def reconcile_sale_dgii(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reconcilia una venta con estado fiscal 'unknown' consultando el trackId o retransmitiendo el XML exacto
    """
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
        
    dgii_cfg = db.query(DGIIConfig).first()
    if not dgii_cfg:
        raise HTTPException(status_code=400, detail="Configuración DGII no encontrada")
        
    # Si ya tiene trackId, consultar estado
    if sale.ecf_track_id:
        try:
            res = httpx.get(f"{dgii_cfg.service_url}/api/ecf/status/{sale.ecf_track_id}", timeout=4.0)
            if res.status_code == 200:
                st_data = res.json()
                sale.fiscal_status = "accepted" if st_data.get("estado") == "Aceptado" else "rejected"
                db.commit()
                return {"success": True, "fiscal_status": sale.fiscal_status, "data": st_data}
        except Exception as e:
            return {"success": False, "message": f"Error al consultar trackId: {str(e)}"}
            
    # Si no tiene trackId pero tenemos el XML firmado previamente
    return {"success": False, "message": "No se cuenta con trackId para reconciliar automáticamente"}

@router.post("/{sale_id}/devolucion")
def process_sale_return(
    sale_id: int,
    payload: SaleReturnRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_cancel_sales"))
):
    """
    Devolución Parcial o Total de Venta con emisión de Nota de Crédito Electrónica (e-NCF E34).
    Preserva la integridad del registro histórico original en 'sales' sin sobreescrituras destructivas.
    """
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale.status == "cancelled":
        raise HTTPException(status_code=400, detail="La venta ya fue anulada previamente")
        
    # Determinar items a devolver
    items_to_return = []
    if payload.items and len(payload.items) > 0:
        for rit in payload.items:
            orig_item = None
            if rit.sale_item_id:
                orig_item = db.query(SaleItem).filter(SaleItem.id == rit.sale_item_id, SaleItem.sale_id == sale.id).first()
            elif rit.product_id:
                orig_item = db.query(SaleItem).filter(SaleItem.product_id == rit.product_id, SaleItem.sale_id == sale.id).first()
                
            if not orig_item:
                raise HTTPException(status_code=400, detail=f"Item no encontrado en la venta original")
            if rit.quantity > orig_item.quantity:
                raise HTTPException(status_code=400, detail=f"Cantidad devuelta ({rit.quantity}) excede la venta original ({orig_item.quantity})")
                
            items_to_return.append({
                "orig_item": orig_item,
                "quantity": rit.quantity
            })
    else:
        # Devolución total
        for it in sale.items:
            items_to_return.append({
                "orig_item": it,
                "quantity": it.quantity
            })

    # Cálculos monetarios de la devolución
    ret_subtotal = 0.0
    ret_itbis = 0.0
    ret_total = 0.0
    
    for entry in items_to_return:
        oit = entry["orig_item"]
        qty = entry["quantity"]
        unit_p = oit.unit_price
        tax_mult = oit.tax_rate / 100.0
        
        # Proporción
        line_tot = round(qty * unit_p, 2)
        if oit.tax_rate > 0:
            line_sub = round(line_tot / (1.0 + tax_mult), 2)
            line_tax = round(line_tot - line_sub, 2)
        else:
            line_sub = line_tot
            line_tax = 0.0
            
        ret_subtotal = round(ret_subtotal + line_sub, 2)
        ret_itbis = round(ret_itbis + line_tax, 2)
        ret_total = round(ret_total + line_tot, 2)

    # Asignar secuencia de Nota de Crédito e-NCF E34 con Mutex y transacción dedicada
    with SEQUENCE_LOCK:
        with engine.begin() as conn:
            cfg_row = conn.execute(text("SELECT id, secuencia_e34_actual FROM dgii_config LIMIT 1")).fetchone()
            if not cfg_row:
                cfg_id, s_e34 = 1, 1
            else:
                cfg_id, s_e34 = cfg_row[0], (cfg_row[1] or 1)
            seq_num = s_e34
            e34_encf = f"E34{seq_num:010d}"
            conn.execute(text("UPDATE dgii_config SET secuencia_e34_actual = :nxt WHERE id = :cid"), {"nxt": s_e34 + 1, "cid": cfg_id})

    try:
        sale_return = SaleReturn(
            sale_id=sale.id,
            cashier_id=current_user.id,
            encf=e34_encf,
            modified_encf=sale.encf,
            subtotal=ret_subtotal,
            itbis=ret_itbis,
            total=ret_total,
            reason=payload.reason,
            refund_method=payload.refund_method or "cash",
            fiscal_status="pending",
            created_at=datetime.utcnow()
        )
        db.add(sale_return)
        db.flush()

        # Registrar items devueltos y reingresar stock al inventario
        for entry in items_to_return:
            oit = entry["orig_item"]
            qty = entry["quantity"]
            sri = SaleReturnItem(
                return_id=sale_return.id,
                sale_item_id=oit.id,
                product_id=oit.product_id,
                name=oit.name,
                quantity=qty,
                unit_price=oit.unit_price,
                subtotal=round(qty * oit.unit_price / (1.0 + (oit.tax_rate / 100.0)), 2) if oit.tax_rate > 0 else round(qty * oit.unit_price, 2),
                itbis=round((qty * oit.unit_price) - (qty * oit.unit_price / (1.0 + (oit.tax_rate / 100.0))), 2) if oit.tax_rate > 0 else 0.0,
                total=round(qty * oit.unit_price, 2)
            )
            db.add(sri)

            if oit.product_id:
                pid = oit.product_id
                db.execute(
                    text("UPDATE products SET stock = stock + :qty WHERE id = :pid"),
                    {"qty": qty, "pid": pid}
                )
                cur_row = db.execute(text("SELECT stock FROM products WHERE id = :pid"), {"pid": pid}).fetchone()
                new_st = cur_row[0] if cur_row else 0.0
                prev_st = round(new_st - qty, 2)
                mov = StockMovement(
                    product_id=pid,
                    type="entrada",
                    quantity=qty,
                    previous_stock=prev_st,
                    new_stock=new_st,
                    notes=f"Devolución NC #{e34_encf} afectando venta {sale.encf}"
                )
                db.add(mov)

        # Si el método de reembolso es reversar crédito o fue venta a crédito
        if payload.refund_method == "revert_credit" or sale.payment_credit > 0:
            if sale.client_id:
                cl = db.query(Client).filter(Client.id == sale.client_id).first()
                if cl:
                    p_bal = cl.current_balance
                    cl.current_balance = round(max(0.0, cl.current_balance - ret_total), 2)
                    crmov = CreditMovement(
                        client_id=cl.id,
                        sale_id=sale.id,
                        type="abono",
                        amount=ret_total,
                        previous_balance=p_bal,
                        new_balance=cl.current_balance,
                        notes=f"Reversión crédito por Nota de Crédito {e34_encf}"
                    )
                    db.add(crmov)

        # Si la devolución cubrió el total de la venta, marcar status comercial como 'cancelled'
        if len(items_to_return) == len(sale.items):
            is_full = all(e["quantity"] == e["orig_item"].quantity for e in items_to_return)
            if is_full:
                sale.status = "cancelled"

        db.commit()
        db.refresh(sale_return)

        # Timbrado con DGII de la Nota de Crédito E34
        dgii_cfg = db.query(DGIIConfig).first()
        if dgii_cfg and dgii_cfg.auto_envio_dgii:
            try:
                nc_payload = {
                    "tipoEcf": "34",
                    "encf": e34_encf,
                    "ncfModificado": sale.encf,
                    "fechaVencimientoSecuencia": dgii_cfg.vencimiento_e32,
                    "tipoPago": 1,
                    "formaPago": 7, # 7 = Nota de Crédito
                    "comprador": {
                        "rnc": sale.client_rnc or "000000000",
                        "razonSocial": sale.client_name
                    },
                    "items": [
                        {
                            "nombre": e["orig_item"].name,
                            "cantidad": e["quantity"],
                            "precioUnitario": e["orig_item"].unit_price,
                            "tasaItbis": e["orig_item"].tax_rate,
                            "itemType": getattr(e["orig_item"], "item_type", "bien") or "bien"
                        }
                        for e in items_to_return
                    ]
                }
                res = httpx.post(f"{dgii_cfg.service_url}/api/ecf/send", json=nc_payload, timeout=3.5)
                if res.status_code == 200:
                    d = res.json()
                    sale_return.ecf_track_id = d.get("trackId")
                    sale_return.security_code = d.get("codigoSeguridad") or d.get("securityCode")
                    sale_return.fiscal_status = "accepted"
                    sale_return.xml_content = d.get("xml")
                    db.commit()
            except Exception as e:
                print(f"Aviso timbrado E34: {e}")

        return {
            "success": True,
            "message": f"Devolución procesada exitosamente con Nota de Crédito {e34_encf}",
            "return_id": sale_return.id,
            "encf": e34_encf,
            "modified_encf": sale.encf,
            "total_devuelto": ret_total
        }

    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al procesar devolución: {str(exc)}")

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
            "fiscal_status": getattr(s, "fiscal_status", "pending") or "pending",
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
    Ruta legacy de anulación rápida: invoca internamente el flujo de devolución con Nota de Crédito
    """
    req = SaleReturnRequest(reason="Anulación completa desde terminal POS")
    return process_sale_return(sale_id, req, db, current_user)
