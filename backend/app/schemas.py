from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# ================================
# USUARIOS & AUTH
# ================================
class UserLogin(BaseModel):
    username_or_email: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    role: Optional[str] = "cajero"
    can_discount: Optional[bool] = True
    can_view_costs: Optional[bool] = False
    can_modify_inventory: Optional[bool] = False
    can_corte: Optional[bool] = True
    can_cancel_sales: Optional[bool] = False
    can_change_prices: Optional[bool] = False
    can_manage_clients: Optional[bool] = True
    can_view_reports: Optional[bool] = False
    can_access_config: Optional[bool] = False

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    can_discount: Optional[bool] = None
    can_view_costs: Optional[bool] = None
    can_modify_inventory: Optional[bool] = None
    can_corte: Optional[bool] = None
    can_cancel_sales: Optional[bool] = None
    can_change_prices: Optional[bool] = None
    can_manage_clients: Optional[bool] = None
    can_view_reports: Optional[bool] = None
    can_access_config: Optional[bool] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    can_discount: bool
    can_view_costs: bool
    can_modify_inventory: bool
    can_corte: bool
    can_cancel_sales: bool
    can_change_prices: bool = False
    can_manage_clients: bool = True
    can_view_reports: bool = False
    can_access_config: bool = False

    class Config:
        from_attributes = True

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# ================================
# DEPARTAMENTOS & PRODUCTOS
# ================================
class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    barcode: str
    sku: Optional[str] = None
    name: str
    description: Optional[str] = None
    department_id: Optional[int] = None
    sell_type: Optional[str] = "unit" # "unit", "bulk", "package"
    cost_price: float = 0.0
    margin_percent: float = 30.0
    sale_price: float
    tax_rate: float = 18.0
    wholesale_price: Optional[float] = None
    wholesale_quantity: Optional[float] = None
    stock: float = 0.0
    min_stock: float = 5.0
    max_stock: float = 100.0

class ProductOut(ProductCreate):
    id: int
    is_active: bool
    department: Optional[DepartmentOut] = None
    created_at: datetime
    class Config:
        from_attributes = True

# ================================
# CLIENTES & CRÉDITO ("EL FIADO")
# ================================
class ClientCreate(BaseModel):
    name: str
    rnc_cedula: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    credit_limit: float = 5000.0

class ClientOut(ClientCreate):
    id: int
    current_balance: float
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class CreditPaymentRequest(BaseModel):
    amount: float
    notes: Optional[str] = "Abono a cuenta"

# ================================
# COMPRAS & PROVEEDORES
# ================================
class SupplierCreate(BaseModel):
    name: str
    rnc: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None

class SupplierOut(SupplierCreate):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class PurchaseItemInput(BaseModel):
    product_id: int
    quantity: float
    cost_price: float

class PurchaseCreate(BaseModel):
    supplier_id: int
    invoice_number: Optional[str] = None
    notes: Optional[str] = None
    expense_type: Optional[str] = "09"
    payment_method: Optional[str] = "01"
    subtotal: Optional[float] = None
    itbis: Optional[float] = None
    modified_ncf: Optional[str] = None
    itbis_retained: Optional[float] = 0.0
    isr_retained: Optional[float] = 0.0
    items: List[PurchaseItemInput]

# ================================
# CAJA & TURNOS (F6)
# ================================
class OpenSessionRequest(BaseModel):
    initial_cash: float = 0.0
    notes: Optional[str] = ""

class CloseSessionRequest(BaseModel):
    final_cash_counted: float
    notes: Optional[str] = ""
    bills_breakdown: Optional[Dict[str, int]] = None

class CashMovementRequest(BaseModel):
    type: str # "entrada" o "salida"
    amount: float
    reason: str

# ================================
# VENTAS (F1)
# ================================
class SaleItemInput(BaseModel):
    product_id: Optional[int] = None
    barcode: Optional[str] = None
    name: str
    quantity: float = 1.0
    unit_price: float
    tax_rate: float = 18.0

class SaleCreateRequest(BaseModel):
    client_id: Optional[int] = None
    client_name: str = "Consumidor Final"
    client_rnc: Optional[str] = None
    ncf_type: str = "E32" # E32=Consumo, E31=Crédito Fiscal
    payment_method: str = "cash" # cash, card, transfer, credit, mixed
    cash_received: float = 0.0
    items: List[SaleItemInput]
    send_to_dgii: bool = True

class SaleOut(BaseModel):
    id: int
    client_name: str
    client_rnc: Optional[str]
    subtotal: float
    itbis: float
    total: float
    payment_method: str
    cash_received: float
    cash_change: float
    ncf_type: str
    encf: str
    ecf_track_id: Optional[str]
    security_code: Optional[str]
    dgii_status: str
    created_at: datetime
    items: List[Any]
    class Config:
        from_attributes = True

# ================================
# DGII CONFIG
# ================================
class DGIIConfigUpdate(BaseModel):
    environment: Optional[str] = None
    rnc_emisor: Optional[str] = None
    razon_social: Optional[str] = None
    nombre_comercial: Optional[str] = None
    direccion: Optional[str] = None
    provincia: Optional[str] = None
    municipio: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    cert_path: Optional[str] = None
    cert_password: Optional[str] = None
    secuencia_e31_actual: Optional[int] = None
    secuencia_e31_fin: Optional[int] = None
    vencimiento_e31: Optional[str] = None
    secuencia_e32_actual: Optional[int] = None
    secuencia_e32_fin: Optional[int] = None
    vencimiento_e32: Optional[str] = None
    auto_envio_dgii: Optional[bool] = None
    modo_contingencia: Optional[bool] = None

# ================================
# STORE SETTINGS
# ================================
class StoreSettingsUpdate(BaseModel):
    store_name: Optional[str] = None
    slogan: Optional[str] = None
    rnc: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    currency_symbol: Optional[str] = None
    currency_name: Optional[str] = None
    ticket_header: Optional[str] = None
    ticket_footer: Optional[str] = None
    printer_width: Optional[int] = None
    printer_copies: Optional[int] = None
    auto_print_ticket: Optional[bool] = None
    show_logo_on_ticket: Optional[bool] = None
    show_cashier_on_ticket: Optional[bool] = None
    show_tax_details: Optional[bool] = None
    show_dgii_qr: Optional[bool] = None
    font_size: Optional[str] = None
    auto_open_drawer: Optional[bool] = None
    drawer_on_cash_sale: Optional[bool] = None
    drawer_on_movement: Optional[bool] = None
    scale_enabled: Optional[bool] = None
    scale_model: Optional[str] = None
    scale_port: Optional[str] = None
    barcode_scanner_beep: Optional[bool] = None
    allow_sales_without_stock: Optional[bool] = None
    warn_low_stock_on_sale: Optional[bool] = None
    ask_confirm_delete_item: Optional[bool] = None
    costing_method: Optional[str] = None
    prices_include_tax: Optional[bool] = None
    accept_cash: Optional[bool] = None
    accept_card: Optional[bool] = None
    accept_transfer: Optional[bool] = None
    accept_credit: Optional[bool] = None
    email_corte_notification: Optional[bool] = None
    corte_notification_email: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
