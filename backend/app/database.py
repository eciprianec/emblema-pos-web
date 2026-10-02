from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./emblemapos.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
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

            # Columnas adicionales para sales (Formato 607 DGII)
            sales_cols_res = conn.execute(text("PRAGMA table_info(sales)"))
            existing_sales_cols = {row[1] for row in sales_cols_res.fetchall()}
            sales_additions = [
                ("income_type", "VARCHAR(10) DEFAULT '01'"),
                ("modified_ncf", "VARCHAR(50) DEFAULT NULL")
            ]
            for col, col_def in sales_additions:
                if col not in existing_sales_cols:
                    conn.execute(text(f"ALTER TABLE sales ADD COLUMN {col} {col_def}"))

            conn.commit()
    except Exception as e:
        print(f"Aviso en ensure_schema_upgrades: {e}")
