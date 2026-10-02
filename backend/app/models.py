from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# ================================
# USUARIOS & CAJEROS
# ================================
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="cajero") # "admin", "cajero"
    is_active = Column(Boolean, default=True)
    
    # Matriz de permisos del sistema
    can_discount = Column(Boolean, default=True)
    can_view_costs = Column(Boolean, default=False)
    can_modify_inventory = Column(Boolean, default=False)
    can_corte = Column(Boolean, default=True)
    can_cancel_sales = Column(Boolean, default=False)
    can_change_prices = Column(Boolean, default=False)
    can_manage_clients = Column(Boolean, default=True)
    can_view_reports = Column(Boolean, default=False)
    can_access_config = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sales = relationship("Sale", back_populates="cashier")
    sessions = relationship("CashSession", back_populates="cashier")

# ================================
# DEPARTAMENTOS / CATEGORÍAS
# ================================
class Department(Base):
    __tablename__ = "departments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    
    products = relationship("Product", back_populates="department")

# ================================
# PRODUCTOS & SERVICIOS
# ================================
class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(50), unique=True, index=True, nullable=False)
    sku = Column(String(50), nullable=True)
    name = Column(String(150), index=True, nullable=False)
    description = Column(Text, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # Forma de venta: 'unit' (por unidad), 'bulk' (a granel/peso), 'package' (por paquete)
    sell_type = Column(String(20), default="unit")
    
    cost_price = Column(Float, default=0.0)
    margin_percent = Column(Float, default=30.0) # Margen de ganancia
    sale_price = Column(Float, nullable=False)
    tax_rate = Column(Float, default=18.0) # 18% ITBIS o 0% exento
    
    # Mayoreo
    wholesale_price = Column(Float, nullable=True)
    wholesale_quantity = Column(Float, nullable=True)
    
    # Control de inventario
    stock = Column(Float, default=0.0)
    min_stock = Column(Float, default=5.0)
    max_stock = Column(Float, default=100.0)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    department = relationship("Department", back_populates="products")
    movements = relationship("StockMovement", back_populates="product")

# ================================
# CLIENTES & CRÉDITO ("EL FIADO")
# ================================
class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    rnc_cedula = Column(String(20), nullable=True, index=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(String(255), nullable=True)
    
    credit_limit = Column(Float, default=5000.0)
    current_balance = Column(Float, default=0.0) # Deuda acumulada
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    movements = relationship("CreditMovement", back_populates="client")
    sales = relationship("Sale", back_populates="client")

class CreditMovement(Base):
    __tablename__ = "credit_movements"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True)
    type = Column(String(20), nullable=False) # "cargo" (compra a crédito), "abono" (pago de deuda)
    amount = Column(Float, nullable=False)
    previous_balance = Column(Float, nullable=False)
    new_balance = Column(Float, nullable=False)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    client = relationship("Client", back_populates="movements")

# ================================
# COMPRAS & PROVEEDORES
# ================================
class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    rnc = Column(String(20), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(String(255), nullable=True)
    contact_person = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    purchases = relationship("Purchase", back_populates="supplier")

class Purchase(Base):
    __tablename__ = "purchases"
    
    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    invoice_number = Column(String(50), nullable=True)
    total = Column(Float, default=0.0)
    subtotal = Column(Float, default=0.0)
    itbis = Column(Float, default=0.0)
    expense_type = Column(String(10), default="09") # 606 DGII: 01-11
    payment_method = Column(String(10), default="01") # 606 DGII: 01-07
    modified_ncf = Column(String(50), nullable=True)
    itbis_retained = Column(Float, default=0.0)
    isr_retained = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    supplier = relationship("Supplier", back_populates="purchases")
    items = relationship("PurchaseItem", back_populates="purchase")

class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    
    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    
    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product")

# ================================
# CONTROL DE CAJA & TURNOS (F6)
# ================================
class CashSession(Base):
    __tablename__ = "cash_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opened_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    
    initial_cash = Column(Float, default=0.0)
    final_cash_counted = Column(Float, nullable=True)
    expected_cash = Column(Float, default=0.0)
    difference = Column(Float, default=0.0) # Sobrante (+) o Faltante (-)
    status = Column(String(20), default="open") # "open", "closed"
    notes = Column(Text, nullable=True)
    bills_breakdown = Column(Text, nullable=True) # JSON de billetes RD$
    
    cashier = relationship("User", back_populates="sessions")
    movements = relationship("CashMovement", back_populates="session")
    sales = relationship("Sale", back_populates="session")

class CashMovement(Base):
    __tablename__ = "cash_movements"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=False)
    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(20), nullable=False) # "entrada" (F7), "salida" (F8)
    amount = Column(Float, nullable=False)
    reason = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("CashSession", back_populates="movements")

# ================================
# VENTAS & FACTURACIÓN (F1)
# ================================
class Sale(Base):
    __tablename__ = "sales"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=True)
    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    client_name = Column(String(100), default="Consumidor Final")
    client_rnc = Column(String(20), nullable=True)
    
    subtotal = Column(Float, default=0.0)
    itbis = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    cost_total = Column(Float, default=0.0) # Para cálculo instantáneo de ganancia
    
    payment_method = Column(String(20), default="cash") # "cash", "card", "transfer", "credit", "mixed"
    cash_received = Column(Float, default=0.0)
    cash_change = Column(Float, default=0.0)
    
    # Comprobante Fiscal Electrónico (DGII e-CF) & Formato 607
    ncf_type = Column(String(10), default="E32") # "E32"=Consumo, "E31"=Crédito Fiscal
    encf = Column(String(20), nullable=False, index=True)
    ecf_track_id = Column(String(50), nullable=True)
    security_code = Column(String(20), nullable=True)
    dgii_status = Column(String(20), default="pending") # "pending", "sent", "accepted", "rejected"
    income_type = Column(String(10), default="01") # DGII: "01"=Ingresos por operaciones
    modified_ncf = Column(String(50), nullable=True)
    
    status = Column(String(20), default="completed") # "completed", "cancelled"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    cashier = relationship("User", back_populates="sales")
    session = relationship("CashSession", back_populates="sales")
    client = relationship("Client", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale")

class SaleItem(Base):
    __tablename__ = "sale_items"
    
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    name = Column(String(150), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=False)
    cost_price = Column(Float, default=0.0)
    tax_rate = Column(Float, default=18.0)
    subtotal = Column(Float, nullable=False)
    itbis = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    
    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")

# ================================
# MOVIMIENTOS DE STOCK (KÁRDEX)
# ================================
class StockMovement(Base):
    __tablename__ = "stock_movements"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    type = Column(String(20), nullable=False) # "venta", "compra", "entrada", "salida", "ajuste", "merma"
    quantity = Column(Float, nullable=False)
    previous_stock = Column(Float, nullable=False)
    new_stock = Column(Float, nullable=False)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    product = relationship("Product", back_populates="movements")

# ================================
# CONFIGURACIÓN DGII e-CF
# ================================
class DGIIConfig(Base):
    __tablename__ = "dgii_config"
    
    id = Column(Integer, primary_key=True, index=True)
    environment = Column(String(10), default="DEV") # "DEV", "CERT", "PROD"
    service_url = Column(String(100), default="http://localhost:3001")
    
    rnc_emisor = Column(String(20), default="101010101")
    razon_social = Column(String(150), default="Mi Empresa SRL")
    nombre_comercial = Column(String(150), default="Emblema POS")
    direccion = Column(String(255), default="Santo Domingo, República Dominicana")
    provincia = Column(String(10), default="010000") # Distrito Nacional
    municipio = Column(String(10), default="010100") # Santo Domingo
    telefono = Column(String(30), default="809-555-0000")
    email = Column(String(100), default="facturacion@empresa.com")
    
    cert_path = Column(String(255), default="./certs/certificate.p12")
    cert_password = Column(String(100), default="")
    cert_status = Column(String(20), default="pending")
    cert_expiry = Column(String(50), nullable=True)
    cert_subject = Column(String(150), nullable=True)
    
    # Secuencias e-NCF
    secuencia_e31_actual = Column(Integer, default=1)
    secuencia_e31_fin = Column(Integer, default=10000)
    vencimiento_e31 = Column(String(20), default="31-12-2026")
    
    secuencia_e32_actual = Column(Integer, default=1)
    secuencia_e32_fin = Column(Integer, default=50000)
    vencimiento_e32 = Column(String(20), default="31-12-2026")
    
    secuencia_e33_actual = Column(Integer, default=1)
    secuencia_e34_actual = Column(Integer, default=1)
    
    auto_envio_dgii = Column(Boolean, default=True)
    modo_contingencia = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ================================
# CONFIGURACIÓN DEL NEGOCIO / TICKET
# ================================
class StoreSettings(Base):
    __tablename__ = "store_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    store_name = Column(String(150), default="Mi Negocio")
    slogan = Column(String(150), default="Punto de Venta & Facturación")
    rnc = Column(String(20), default="101010101")
    phone = Column(String(30), default="809-555-0000")
    address = Column(String(255), default="Calle Principal #1, Santo Domingo")
    email = Column(String(100), default="contacto@ciberemblema.com")
    whatsapp = Column(String(30), default="809-555-0000")
    
    # Moneda y Formato
    currency_symbol = Column(String(10), default="RD$")
    currency_name = Column(String(50), default="Pesos Dominicanos")
    
    # Impresora & Personalización del Ticket
    ticket_header = Column(Text, default="¡Gracias por su compra!")
    ticket_footer = Column(Text, default="No se aceptan devoluciones después de 48 horas.")
    printer_width = Column(Integer, default=80) # 80mm o 58mm
    printer_copies = Column(Integer, default=1)
    auto_print_ticket = Column(Boolean, default=True)
    show_logo_on_ticket = Column(Boolean, default=True)
    show_cashier_on_ticket = Column(Boolean, default=True)
    show_tax_details = Column(Boolean, default=True)
    show_dgii_qr = Column(Boolean, default=True)
    font_size = Column(String(20), default="normal") # 'normal', 'compact'
    
    # Cajón de Dinero & Hardware
    auto_open_drawer = Column(Boolean, default=True)
    drawer_on_cash_sale = Column(Boolean, default=True)
    drawer_on_movement = Column(Boolean, default=True)
    scale_enabled = Column(Boolean, default=False)
    scale_model = Column(String(50), default="Torrey / Rhino")
    scale_port = Column(String(20), default="COM1")
    barcode_scanner_beep = Column(Boolean, default=True)
    
    # Comportamiento de Venta & Inventarios
    allow_sales_without_stock = Column(Boolean, default=True)
    warn_low_stock_on_sale = Column(Boolean, default=True)
    ask_confirm_delete_item = Column(Boolean, default=False)
    costing_method = Column(String(30), default="last_cost") # 'last_cost' o 'average'
    prices_include_tax = Column(Boolean, default=True)
    
    # Formas de Pago Aceptadas
    accept_cash = Column(Boolean, default=True)
    accept_card = Column(Boolean, default=True)
    accept_transfer = Column(Boolean, default=True)
    accept_credit = Column(Boolean, default=True)
    
    # Notificaciones por Correo Electrónico
    email_corte_notification = Column(Boolean, default=False)
    corte_notification_email = Column(String(100), default="")
    smtp_host = Column(String(100), default="")
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String(100), default="")
    smtp_password = Column(String(100), default="")
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
