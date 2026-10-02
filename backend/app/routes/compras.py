from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Supplier, Purchase, PurchaseItem, Product, StockMovement, User
from ..schemas import SupplierCreate, SupplierOut, PurchaseCreate
from ..auth import get_current_user

router = APIRouter(prefix="/compras", tags=["compras"])

@router.get("/suppliers", response_model=List[SupplierOut])
@router.get("/proveedores", response_model=List[SupplierOut])
def get_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).order_by(Supplier.name.asc()).all()

@router.post("/suppliers", response_model=SupplierOut)
@router.post("/proveedores", response_model=SupplierOut)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    supplier = Supplier(**payload.dict())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier

@router.get("")
def get_purchases(db: Session = Depends(get_db)):
    purchases = db.query(Purchase).order_by(Purchase.created_at.desc()).limit(50).all()
    return [
        {
            "id": p.id,
            "invoice_number": p.invoice_number,
            "supplier_name": p.supplier.name if p.supplier else "N/A",
            "supplier_rnc": p.supplier.rnc if p.supplier else None,
            "total": p.total,
            "subtotal": p.subtotal or round(p.total / 1.18, 2),
            "itbis": p.itbis or round(p.total - round(p.total / 1.18, 2), 2),
            "expense_type": p.expense_type or "09",
            "payment_method": p.payment_method or "01",
            "notes": p.notes,
            "date": p.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "items_count": len(p.items)
        }
        for p in purchases
    ]

@router.post("")
def record_purchase(
    payload: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        
    if not payload.items:
        raise HTTPException(status_code=400, detail="Debe ingresar al menos un artículo a la compra")
        
    total_purchase = sum(it.quantity * it.cost_price for it in payload.items)
    calc_subtotal = payload.subtotal if payload.subtotal is not None else round(total_purchase / 1.18, 2)
    calc_itbis = payload.itbis if payload.itbis is not None else round(total_purchase - calc_subtotal, 2)
    
    purchase = Purchase(
        supplier_id=supplier.id,
        invoice_number=payload.invoice_number,
        total=total_purchase,
        subtotal=calc_subtotal,
        itbis=calc_itbis,
        expense_type=payload.expense_type or "09",
        payment_method=payload.payment_method or "01",
        modified_ncf=payload.modified_ncf,
        itbis_retained=payload.itbis_retained or 0.0,
        isr_retained=payload.isr_retained or 0.0,
        notes=payload.notes
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    
    for it in payload.items:
        prod = db.query(Product).filter(Product.id == it.product_id).first()
        if prod:
            prev_stock = prod.stock
            prod.stock += it.quantity
            prod.cost_price = it.cost_price # Actualiza costo más reciente
            
            # Recalcular precio de venta sugerido basado en margen
            if prod.margin_percent > 0:
                prod.sale_price = round(prod.cost_price * (1 + prod.margin_percent / 100), 2)
                
            item_record = PurchaseItem(
                purchase_id=purchase.id,
                product_id=prod.id,
                quantity=it.quantity,
                cost_price=it.cost_price,
                total=(it.quantity * it.cost_price)
            )
            db.add(item_record)
            
            mov = StockMovement(
                product_id=prod.id,
                type="compra",
                quantity=it.quantity,
                previous_stock=prev_stock,
                new_stock=prod.stock,
                notes=f"Compra Fac: {payload.invoice_number or purchase.id} Prov: {supplier.name}"
            )
            db.add(mov)
            
    db.commit()
    
    return {
        "success": True,
        "message": f"Compra de RD${total_purchase:,.2f} registrada exitosamente",
        "purchase_id": purchase.id,
        "total": total_purchase
    }
