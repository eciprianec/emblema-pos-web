from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./emblemapos.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Garantiza concurrencia óptima, integridad referencial y prevención de locks en SQLite"""
    if "sqlite" in DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("PRAGMA journal_mode = WAL;")
        cursor.execute("PRAGMA busy_timeout = 10000;")
        cursor.execute("PRAGMA synchronous = NORMAL;")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def ensure_schema_upgrades():
    """Garantiza que cualquier columna añadida a StoreSettings o User exista en la base SQLite"""
    try:
        with engine.connect() as conn:
            # Columnas adicionales para users
            user_cols_res = conn.execute(text("PRAGMA table_info(users)"))
            existing_user_cols = {row[1] for row in user_cols_res.fetchall()}
            
            user_additions = [
                ("can_change_prices", "BOOLEAN DEFAULT 0"),
                ("can_manage_clients", "BOOLEAN DEFAULT 1"),
                ("can_view_reports", "BOOLEAN DEFAULT 0"),
                ("can_access_config", "BOOLEAN DEFAULT 0")
            ]
            for col, col_def in user_additions:
                if col not in existing_user_cols:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_def}"))
                    
            # Columnas adicionales para store_settings
            store_cols_res = conn.execute(text("PRAGMA table_info(store_settings)"))
            existing_store_cols = {row[1] for row in store_cols_res.fetchall()}
            
            store_additions = [
                ("email", "VARCHAR(100) DEFAULT 'contacto@ciberemblema.com'"),
                ("whatsapp", "VARCHAR(30) DEFAULT '809-555-0000'"),
                ("currency_symbol", "VARCHAR(10) DEFAULT 'RD$'"),
                ("currency_name", "VARCHAR(50) DEFAULT 'Pesos Dominicanos'"),
                ("printer_copies", "INTEGER DEFAULT 1"),
                ("auto_print_ticket", "BOOLEAN DEFAULT 1"),
                ("show_logo_on_ticket", "BOOLEAN DEFAULT 1"),
                ("show_cashier_on_ticket", "BOOLEAN DEFAULT 1"),
                ("show_tax_details", "BOOLEAN DEFAULT 1"),
                ("show_dgii_qr", "BOOLEAN DEFAULT 1"),
                ("font_size", "VARCHAR(20) DEFAULT 'normal'"),
                ("drawer_on_cash_sale", "BOOLEAN DEFAULT 1"),
                ("drawer_on_movement", "BOOLEAN DEFAULT 1"),
                ("scale_enabled", "BOOLEAN DEFAULT 0"),
                ("scale_model", "VARCHAR(50) DEFAULT 'Torrey / Rhino'"),
                ("scale_port", "VARCHAR(20) DEFAULT 'COM1'"),
                ("barcode_scanner_beep", "BOOLEAN DEFAULT 1"),
                ("allow_sales_without_stock", "BOOLEAN DEFAULT 1"),
                ("warn_low_stock_on_sale", "BOOLEAN DEFAULT 1"),
                ("ask_confirm_delete_item", "BOOLEAN DEFAULT 0"),
                ("costing_method", "VARCHAR(30) DEFAULT 'last_cost'"),
                ("prices_include_tax", "BOOLEAN DEFAULT 1"),
                ("accept_cash", "BOOLEAN DEFAULT 1"),
                ("accept_card", "BOOLEAN DEFAULT 1"),
                ("accept_transfer", "BOOLEAN DEFAULT 1"),
                ("accept_credit", "BOOLEAN DEFAULT 1"),
                ("email_corte_notification", "BOOLEAN DEFAULT 0"),
                ("corte_notification_email", "VARCHAR(100) DEFAULT ''"),
                ("smtp_host", "VARCHAR(100) DEFAULT ''"),
                ("smtp_port", "INTEGER DEFAULT 587"),
                ("smtp_user", "VARCHAR(100) DEFAULT ''"),
                ("smtp_password", "VARCHAR(100) DEFAULT ''")
            ]
            for col, col_def in store_additions:
                if col not in existing_store_cols:
                    conn.execute(text(f"ALTER TABLE store_settings ADD COLUMN {col} {col_def}"))
                    
            # Columnas adicionales para purchases (Formato 606 DGII)
            purchase_cols_res = conn.execute(text("PRAGMA table_info(purchases)"))
            existing_purchase_cols = {row[1] for row in purchase_cols_res.fetchall()}
            purchase_additions = [
                ("subtotal", "FLOAT DEFAULT 0.0"),
                ("itbis", "FLOAT DEFAULT 0.0"),
                ("expense_type", "VARCHAR(10) DEFAULT '09'"),
                ("payment_method", "VARCHAR(10) DEFAULT '01'"),
                ("modified_ncf", "VARCHAR(50) DEFAULT NULL"),
                ("itbis_retained", "FLOAT DEFAULT 0.0"),
                ("isr_retained", "FLOAT DEFAULT 0.0")
            ]
            for col, col_def in purchase_additions:
                if col not in existing_purchase_cols:
                    conn.execute(text(f"ALTER TABLE purchases ADD COLUMN {col} {col_def}"))

            # Columnas adicionales para sales (Formato 607 DGII y Pagos Múltiples)
            sales_cols_res = conn.execute(text("PRAGMA table_info(sales)"))
            existing_sales_cols = {row[1] for row in sales_cols_res.fetchall()}
            sales_additions = [
                ("income_type", "VARCHAR(10) DEFAULT '01'"),
                ("modified_ncf", "VARCHAR(50) DEFAULT NULL"),
                ("payment_cash", "FLOAT DEFAULT 0.0"),
                ("payment_card", "FLOAT DEFAULT 0.0"),
                ("payment_transfer", "FLOAT DEFAULT 0.0"),
                ("payment_credit", "FLOAT DEFAULT 0.0"),
                ("fiscal_status", "VARCHAR(20) DEFAULT 'pending'"),
                ("fiscal_error", "TEXT DEFAULT NULL"),
                ("xml_content", "TEXT DEFAULT NULL"),
                ("idempotency_key", "VARCHAR(100) DEFAULT NULL")
            ]
            for col, col_def in sales_additions:
                if col not in existing_sales_cols:
                    conn.execute(text(f"ALTER TABLE sales ADD COLUMN {col} {col_def}"))

            # Columnas adicionales para products (Clasificación DGII bien/servicio)
            prod_cols_res = conn.execute(text("PRAGMA table_info(products)"))
            existing_prod_cols = {row[1] for row in prod_cols_res.fetchall()}
            if "item_type" not in existing_prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN item_type VARCHAR(20) DEFAULT 'bien'"))

            # Columnas adicionales para sale_items
            item_cols_res = conn.execute(text("PRAGMA table_info(sale_items)"))
            existing_item_cols = {row[1] for row in item_cols_res.fetchall()}
            if "item_type" not in existing_item_cols:
                conn.execute(text("ALTER TABLE sale_items ADD COLUMN item_type VARCHAR(20) DEFAULT 'bien'"))

            # Tablas nuevas: sale_payments, sale_returns, sale_return_items
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sale_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                    payment_method VARCHAR(30) NOT NULL,
                    dgii_code INTEGER NOT NULL DEFAULT 1,
                    amount FLOAT NOT NULL,
                    reference VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sale_payments_sale_id ON sale_payments(sale_id);"))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sale_returns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                    cashier_id INTEGER NOT NULL REFERENCES users(id),
                    encf VARCHAR(20) NOT NULL UNIQUE,
                    modified_encf VARCHAR(20) NOT NULL,
                    subtotal FLOAT DEFAULT 0.0,
                    itbis FLOAT DEFAULT 0.0,
                    total FLOAT DEFAULT 0.0,
                    reason VARCHAR(255) NOT NULL,
                    refund_method VARCHAR(30) DEFAULT 'cash',
                    fiscal_status VARCHAR(20) DEFAULT 'pending',
                    ecf_track_id VARCHAR(50),
                    security_code VARCHAR(20),
                    xml_content TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sale_returns_sale_id ON sale_returns(sale_id);"))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sale_return_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    return_id INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
                    sale_item_id INTEGER REFERENCES sale_items(id),
                    product_id INTEGER REFERENCES products(id),
                    name VARCHAR(150) NOT NULL,
                    quantity FLOAT NOT NULL,
                    unit_price FLOAT NOT NULL,
                    subtotal FLOAT NOT NULL,
                    itbis FLOAT DEFAULT 0.0,
                    total FLOAT NOT NULL
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sale_return_items_return_id ON sale_return_items(return_id);"))

            # Índice único para garantizar que nunca se duplique un e-NCF fiscal
            try:
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_encf ON sales(encf)"))
            except Exception as idx_err:
                print(f"Aviso al crear uq_sales_encf: {idx_err}")

            # Índice único para idempotencia
            try:
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_idempotency ON sales(idempotency_key) WHERE idempotency_key IS NOT NULL"))
            except Exception as idx_err:
                print(f"Aviso al crear uq_sales_idempotency: {idx_err}")

            conn.commit()
    except Exception as e:
        print(f"Aviso en ensure_schema_upgrades: {e}")
