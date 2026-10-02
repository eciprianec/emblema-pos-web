from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from ..database import get_db
from ..models import Product, Department, StockMovement, User
from ..schemas import ProductCreate, ProductOut, DepartmentCreate, DepartmentOut
from ..auth import get_current_user

router = APIRouter(prefix="/productos", tags=["productos"])

@router.get("/departments/list", response_model=List[DepartmentOut])
def get_departments(db: Session = Depends(get_db)):
    return db.query(Department).order_by(Department.name.asc()).all()

@router.post("/departments", response_model=DepartmentOut)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Department).filter(Department.name.ilike(payload.name)).first()
    if existing:
        return existing
    dep = Department(name=payload.name, description=payload.description)
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep

@router.get("", response_model=List[ProductOut])
def get_products(
    search: Optional[str] = None,
    department_id: Optional[int] = None,
    low_stock_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Product).filter(Product.is_active == True)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Product.name.ilike(search_filter)) |
            (Product.barcode.ilike(search_filter)) |
            (Product.sku.ilike(search_filter))
        )
        
    if department_id:
        query = query.filter(Product.department_id == department_id)
        
    if low_stock_only:
        query = query.filter(Product.stock <= Product.min_stock)
        
    return query.order_by(Product.name.asc()).all()

@router.get("/barcode/{barcode}", response_model=ProductOut)
def get_product_by_barcode(barcode: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.barcode == barcode, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product

@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product

@router.post("", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Product).filter(Product.barcode == payload.barcode).first()
    if existing:
        if not existing.is_active:
            # Reactivar
            existing.is_active = True
            for key, val in payload.dict().items():
                setattr(existing, key, val)
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(status_code=400, detail="Ya existe un producto con este código de barras")
        
    new_prod = Product(**payload.dict())
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)
    
    # Registrar movimiento inicial de stock si es > 0
    if new_prod.stock > 0:
        mov = StockMovement(
            product_id=new_prod.id,
            type="entrada",
            quantity=new_prod.stock,
            previous_stock=0.0,
            new_stock=new_prod.stock,
            notes="Inventario inicial de creación"
        )
        db.add(mov)
        db.commit()
        
    return new_prod

@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    # Verificar si el nuevo barcode choca con otro producto
    if payload.barcode != product.barcode:
        existing = db.query(Product).filter(Product.barcode == payload.barcode, Product.id != product_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="El código de barras ya pertenece a otro producto")
            
    old_stock = product.stock
    for key, val in payload.dict().items():
        setattr(product, key, val)
        
    db.commit()
    db.refresh(product)
    
    # Si cambió el stock, registrar ajuste
    if old_stock != product.stock:
        mov = StockMovement(
            product_id=product.id,
            type="ajuste",
            quantity=product.stock - old_stock,
            previous_stock=old_stock,
            new_stock=product.stock,
            notes=f"Ajuste manual de edición por {current_user.full_name}"
        )
        db.add(mov)
        db.commit()
        
    return product

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    product.is_active = False
    db.commit()
    return {"success": True, "message": "Producto desactivado correctamente"}
