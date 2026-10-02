from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from ..database import get_db
from ..models import Product, StockMovement, User
from ..auth import get_current_user, require_permission

router = APIRouter(prefix="/inventarios", tags=["inventarios"])

class StockAddRequest(BaseModel):
    product_id: int
    quantity: float
    notes: Optional[str] = "Entrada rápida a inventario"

class StockAdjustRequest(BaseModel):
    product_id: int
    new_quantity: float
    reason: str # "merma", "dañado", "conteo_fisico", "ajuste"

@router.post("/add-stock")
@router.post("/agregar-stock")
def add_stock(
    payload: StockAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_modify_inventory"))
):
    product = db.query(Product).filter(Product.id == payload.product_id, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="La cantidad a ingresar debe ser mayor a 0")
        
    try:
        prev = product.stock
        product.stock = round(product.stock + payload.quantity, 2)
        
        mov = StockMovement(
            product_id=product.id,
            type="entrada",
            quantity=payload.quantity,
            previous_stock=prev,
            new_stock=product.stock,
            notes=payload.notes or f"Entrada manual por {current_user.full_name}"
        )
        db.add(mov)
        db.commit()
        
        return {
            "success": True,
            "message": f"Se agregaron {payload.quantity} unidades a {product.name}",
            "product_id": product.id,
            "previous_stock": prev,
            "new_stock": product.stock
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al ingresar inventario: {str(e)}")

@router.post("/adjust")
@router.post("/ajustar-stock")
def adjust_stock(
    payload: StockAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_modify_inventory"))
):
    product = db.query(Product).filter(Product.id == payload.product_id, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    try:
        prev = product.stock
        diff = round(payload.new_quantity - prev, 2)
        product.stock = round(payload.new_quantity, 2)
        
        mov_type = "merma" if diff < 0 and payload.reason == "merma" else "ajuste"
        
        mov = StockMovement(
            product_id=product.id,
            type=mov_type,
            quantity=abs(diff),
            previous_stock=prev,
            new_stock=product.stock,
            notes=f"Ajuste ({payload.reason}) por {current_user.full_name}: {diff:+.2f}"
        )
        db.add(mov)
        db.commit()
        
        return {
            "success": True,
            "message": f"Inventario de {product.name} ajustado a {payload.new_quantity}",
            "product_id": product.id,
            "previous_stock": prev,
            "new_stock": product.stock
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al ajustar inventario: {str(e)}")


@router.get("/low-stock")
@router.get("/bajo-stock")
def get_low_stock_products(db: Session = Depends(get_db)):
    products = db.query(Product).filter(
        Product.is_active == True,
        Product.stock <= Product.min_stock
    ).order_by(Product.stock.asc()).all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "barcode": p.barcode,
            "stock": p.stock,
            "min_stock": p.min_stock,
            "sale_price": p.sale_price,
            "cost_price": p.cost_price,
            "status": "Agotado" if p.stock <= 0 else "Bajo Inventario"
        }
        for p in products
    ]

@router.get("/valuation")
@router.get("/valuacion")
def get_inventory_valuation(db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.is_active == True).all()
    
    total_cost_value = 0.0
    total_retail_value = 0.0
    total_items_count = 0
    total_stock_count = 0.0
    
    for p in products:
        if p.stock > 0:
            total_cost_value += (p.stock * (p.cost_price or 0.0))
            total_retail_value += (p.stock * p.sale_price)
            total_stock_count += p.stock
            total_items_count += 1
            
    projected_profit = max(0.0, total_retail_value - total_cost_value)
    
    return {
        "total_products_count": len(products),
        "products_in_stock": total_items_count,
        "total_units_in_stock": round(total_stock_count, 2),
        "total_cost_value": round(total_cost_value, 2),
        "total_retail_value": round(total_retail_value, 2),
        "projected_profit": round(projected_profit, 2)
    }

@router.get("/kardex/{product_id}")
def get_product_kardex(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    movements = db.query(StockMovement).filter(
        StockMovement.product_id == product_id
    ).order_by(StockMovement.created_at.desc()).limit(50).all()
    
    return {
        "product": {
            "id": product.id,
            "name": product.name,
            "barcode": product.barcode,
            "current_stock": product.stock,
            "cost_price": product.cost_price,
            "sale_price": product.sale_price
        },
        "movements": [
            {
                "id": m.id,
                "type": m.type,
                "quantity": m.quantity,
                "previous_stock": m.previous_stock,
                "new_stock": m.new_stock,
                "notes": m.notes,
                "date": m.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            for m in movements
        ]
    }
