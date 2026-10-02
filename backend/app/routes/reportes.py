from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional
from ..database import get_db
from ..models import Sale, SaleItem, Product, Client, CashSession, Department, User
from ..auth import get_current_user

router = APIRouter(prefix="/reportes", tags=["reportes"])

@router.get("/dashboard")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Métricas ejecutivas en tiempo real para el Dashboard Principal
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Ventas de Hoy
    today_sales = db.query(Sale).filter(Sale.created_at >= today_start, Sale.status == "completed").all()
    today_revenue = sum(s.total for s in today_sales)
    today_cost = sum(s.cost_total for s in today_sales)
    today_profit = max(0.0, today_revenue - today_cost)
    today_count = len(today_sales)
    
    # 2. Ventas del Mes
    month_sales = db.query(Sale).filter(Sale.created_at >= month_start, Sale.status == "completed").all()
    month_revenue = sum(s.total for s in month_sales)
    month_profit = max(0.0, month_revenue - sum(s.cost_total for s in month_sales))
    
    # 3. Estado de Caja
    open_session = db.query(CashSession).filter(
        CashSession.cashier_id == current_user.id,
        CashSession.status == "open"
    ).first()
    
    # 4. Alertas de Inventario
    low_stock_count = db.query(func.count(Product.id)).filter(
        Product.is_active == True,
        Product.stock <= Product.min_stock
    ).scalar() or 0
    
    # 5. Cuentas por Cobrar (El Fiado)
    total_receivable = db.query(func.sum(Client.current_balance)).filter(
        Client.is_active == True
    ).scalar() or 0.0
    
    # 6. Ventas de los últimos 7 días para gráfico
    seven_days_ago = today_start - timedelta(days=6)
    last_7_days_sales = db.query(Sale).filter(
        Sale.created_at >= seven_days_ago, 
        Sale.status == "completed"
    ).all()
    
    daily_chart = []
    for i in range(7):
        day_date = seven_days_ago + timedelta(days=i)
        day_str = day_date.strftime("%a %d")
        day_next = day_date + timedelta(days=1)
        day_total = sum(s.total for s in last_7_days_sales if day_date <= s.created_at < day_next)
        daily_chart.append({"day": day_str, "total": round(day_total, 2)})
        
    from ..models import CashMovement

    recent_sales = db.query(Sale).order_by(Sale.created_at.desc()).limit(8).all()
    ultimas_ventas = [
        {
            "id": s.id,
            "encf": s.encf,
            "client_name": s.client_name,
            "payment_method": s.payment_method,
            "total": s.total,
            "dgii_status": s.dgii_status,
            "created_at": s.created_at.isoformat()
        }
        for s in recent_sales
    ]

    efectivo_en_caja = 0.0
    if open_session:
        session_sales = db.query(Sale).filter(Sale.session_id == open_session.id, Sale.status == "completed").all()
        cash_sales = sum(s.total for s in session_sales if s.payment_method == "cash")
        session_moves = db.query(CashMovement).filter(CashMovement.session_id == open_session.id).all()
        c_in = sum(m.amount for m in session_moves if m.type == "entrada")
        c_out = sum(m.amount for m in session_moves if m.type == "salida")
        efectivo_en_caja = open_session.initial_cash + cash_sales + c_in - c_out

    return {
        "ventas_hoy": round(today_revenue, 2),
        "costo_hoy": round(today_cost, 2),
        "ganancia_hoy": round(today_profit, 2),
        "margen_hoy": round((today_profit / today_revenue * 100), 1) if today_revenue > 0 else 0.0,
        "total_tickets_hoy": today_count,
        "ticket_promedio": round(today_revenue / today_count, 2) if today_count > 0 else 0.0,
        "efectivo_en_caja": round(efectivo_en_caja, 2),
        "ultimas_ventas": ultimas_ventas,
        "today": {
            "revenue": round(today_revenue, 2),
            "profit": round(today_profit, 2),
            "sales_count": today_count
        },
        "month": {
            "revenue": round(month_revenue, 2),
            "profit": round(month_profit, 2)
        },
        "cash_session": {
            "is_open": bool(open_session),
            "initial_cash": open_session.initial_cash if open_session else 0.0,
            "session_id": open_session.id if open_session else None
        },
        "alerts": {
            "low_stock_count": low_stock_count,
            "total_receivable": round(float(total_receivable), 2)
        },
        "daily_chart": daily_chart
    }

@router.get("/sales-summary")
@router.get("/ventas-periodo")
def get_sales_summary(
    period: str = "today", # 'today', 'week', 'month', 'custom'
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Reporte de Ventas y Ganancias Netas Reales en RD$
    """
    now = datetime.utcnow()
    if period == "today":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        since = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        since = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "custom" and start_date:
        try:
            since = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            since = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif start_date:
        try:
            since = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            since = now.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
    query = db.query(Sale).filter(Sale.created_at >= since, Sale.status == "completed")
    if end_date:
        try:
            until = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Sale.created_at < until)
        except ValueError:
            pass
            
    sales = query.all()
    
    total_revenue = sum(s.total for s in sales)
    total_subtotal = sum(s.subtotal for s in sales)
    total_itbis = sum(s.itbis for s in sales)
    total_cost = sum(s.cost_total for s in sales)
    net_profit = max(0.0, total_revenue - total_cost)
    profit_margin = round((net_profit / total_revenue * 100), 2) if total_revenue > 0 else 0.0
    
    by_method = {
        "cash": round(sum(s.total for s in sales if s.payment_method == "cash"), 2),
        "card": round(sum(s.total for s in sales if s.payment_method == "card"), 2),
        "transfer": round(sum(s.total for s in sales if s.payment_method == "transfer"), 2),
        "credit": round(sum(s.total for s in sales if s.payment_method == "credit"), 2)
    }
    
    return {
        "period": period,
        "sales_count": len(sales),
        "total_revenue": round(total_revenue, 2),
        "total_sales": round(total_revenue, 2),
        "total_subtotal": round(total_subtotal, 2),
        "total_itbis": round(total_itbis, 2),
        "total_cost": round(total_cost, 2),
        "net_profit": round(net_profit, 2),
        "total_profit": round(net_profit, 2),
        "profit_margin": profit_margin,
        "profit_margin_percent": profit_margin,
        "by_payment_method": by_method
    }

@router.get("/top-products")
@router.get("/top-productos")
def get_top_products(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Top de Productos Más Vendidos
    """
    results = db.query(
        SaleItem.name,
        func.sum(SaleItem.quantity).label("total_qty"),
        func.sum(SaleItem.total).label("total_revenue"),
        func.sum(SaleItem.subtotal - (SaleItem.cost_price * SaleItem.quantity)).label("total_profit")
    ).join(Sale).filter(Sale.status == "completed").group_by(SaleItem.name).order_by(
        func.sum(SaleItem.total).desc()
    ).limit(limit).all()
    
    return [
        {
            "id": idx + 1,
            "name": r.name,
            "units_sold": round(float(r.total_qty or 0), 2),
            "total_sales": round(float(r.total_revenue or 0), 2),
            "total_profit": round(float(r.total_profit or 0), 2)
        }
        for idx, r in enumerate(results)
    ]

@router.get("/by-department")
@router.get("/ventas-departamento")
def get_sales_by_department(db: Session = Depends(get_db)):
    """
    Ventas agrupadas por Departamento
    """
    results = db.query(
        Department.name,
        func.sum(SaleItem.total).label("department_total"),
        func.count(SaleItem.id).label("items_sold")
    ).join(Product, Product.department_id == Department.id).join(SaleItem, SaleItem.product_id == Product.id).join(Sale).filter(
        Sale.status == "completed"
    ).group_by(Department.name).all()
    
    return [
        {
            "department": r.name,
            "total": round(float(r.department_total), 2),
            "items_count": r.items_sold
        }
        for r in results
    ]
