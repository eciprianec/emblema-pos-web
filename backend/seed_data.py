"""
Script de inicialización de datos de prueba para Emblema POS Web.
Crea tablas, usuario admin, departamentos, productos de colmado/supermercado dominicano,
clientes con crédito, proveedores y configuraciones DGII y de negocio.
"""
from app.database import engine, SessionLocal, Base
from app.models import (
    User, Department, Product, Client, Supplier, 
    DGIIConfig, StoreSettings
)
from app.auth import get_password_hash

def seed_database():
    print("Creando tablas si no existen...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 1. Usuarios
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                email="admin@emblemapos.com",
                full_name="Administrador del Sistema",
                password=get_password_hash("Admin1234*"),
                role="admin",
                is_active=True
            )
            db.add(admin)
            print("Usuario 'admin' creado (clave: Admin1234*).")

        if not db.query(User).filter(User.username == "cajero").first():
            cajero = User(
                username="cajero",
                email="cajero@emblemapos.com",
                full_name="Cajero Principal",
                password=get_password_hash("Cajero1234*"),
                role="cajero",
                is_active=True
            )
            db.add(cajero)
            print("Usuario 'cajero' creado (clave: Cajero1234*).")
            
        db.commit()

        # 2. Configuración del Negocio
        settings = db.query(StoreSettings).first()
        if not settings:
            settings = StoreSettings(
                store_name="Emblema POS",
                slogan="Soluciones de Punto de Venta Inteligente",
                rnc="101010101",
                phone="809-555-0000",
                address="Av. Winston Churchill #45, Plaza Central, Santo Domingo",
                ticket_header="¡GRACIAS POR PREFERIRNOS!\nCalidad y servicio garantizado.",
                ticket_footer="Conserve este ticket para reclamos.\nNo se aceptan cambios pasadas 48 horas.",
                printer_width=80,
                auto_open_drawer=True
            )
            db.add(settings)
            print("Configuración de tienda creada.")

        # 3. Configuración DGII
        dgii_cfg = db.query(DGIIConfig).first()
        if not dgii_cfg:
            dgii_cfg = DGIIConfig(
                environment="DEV",
                service_url="http://localhost:3001",
                rnc_emisor="101010101",
                razon_social="Ciber Emblema SRL",
                nombre_comercial="Emblema POS",
                direccion="Av. Winston Churchill #45, Santo Domingo",
                provincia="010000",
                municipio="010100",
                telefono="809-555-0000",
                email="facturacion@ciberemblema.com",
                secuencia_e31_actual=1,
                secuencia_e31_fin=10000,
                vencimiento_e31="31-12-2026",
                secuencia_e32_actual=1,
                secuencia_e32_fin=50000,
                vencimiento_e32="31-12-2026",
                auto_envio_dgii=True,
                modo_contingencia=False
            )
            db.add(dgii_cfg)
            print("Configuración DGII e-CF inicializada.")

        db.commit()

        # 4. Departamentos
        dept_names = [
            "Abarrotes", "Bebidas", "Lácteos y Embutidos",
            "Carnicería", "Frutas y Vegetales", "Limpieza",
            "Snacks y Golosinas", "Ferretería"
        ]
        dept_map = {}
        for dname in dept_names:
            dept = db.query(Department).filter(Department.name == dname).first()
            if not dept:
                dept = Department(name=dname, description=f"Departamento de {dname}")
                db.add(dept)
                db.commit()
                db.refresh(dept)
            dept_map[dname] = dept.id
        print("Departamentos listos.")

        # 5. Clientes
        clients_data = [
            {
                "name": "Colmado Don Pedro",
                "rnc_cedula": "101889977",
                "phone": "809-777-1234",
                "address": "Calle 4ta #12, Ensanche La Fe",
                "credit_limit": 25000.0,
                "current_balance": 4500.0
            },
            {
                "name": "Juan Carlos Pérez",
                "rnc_cedula": "001-1234567-8",
                "phone": "829-888-5544",
                "address": "Residencial Las Praderas Apt 3B",
                "credit_limit": 10000.0,
                "current_balance": 0.0
            },
            {
                "name": "Constructora Dominicana SRL",
                "rnc_cedula": "131445566",
                "phone": "809-222-9988",
                "address": "Av. 27 de Febrero esq. Lincoln",
                "credit_limit": 100000.0,
                "current_balance": 18200.0
            }
        ]
        for c in clients_data:
            if not db.query(Client).filter(Client.name == c["name"]).first():
                db.add(Client(**c))
        print("Clientes iniciales creados.")

        # 6. Proveedores
        suppliers_data = [
            {
                "name": "Cervecería Nacional Dominicana",
                "rnc": "101001569",
                "contact_person": "Marcos Reyes",
                "phone": "809-487-3000",
                "email": "pedidos@cnd.com.do",
                "address": "Autopista 30 de Mayo, Santo Domingo"
            },
            {
                "name": "MercaSID S.A.",
                "rnc": "101000252",
                "contact_person": "Laura Santana",
                "phone": "809-565-2141",
                "email": "ventas@mercasid.com.do",
                "address": "Av. Máximo Gómez #182"
            },
            {
                "name": "Induveca S.A.",
                "rnc": "101008741",
                "contact_person": "Roberto Guzmán",
                "phone": "809-573-2411",
                "email": "servicio@induveca.com.do",
                "address": "La Vega, Rep. Dominicana"
            }
        ]
        for s in suppliers_data:
            if not db.query(Supplier).filter(Supplier.name == s["name"]).first():
                db.add(Supplier(**s))
        print("Proveedores iniciales creados.")

        db.commit()

        # 7. Productos con códigos de barra de prueba
        products_data = [
            # Bebidas
            {
                "barcode": "74601001",
                "name": "Cerveza Presidente Regular 650ml (Grande)",
                "cost_price": 140.0,
                "margin_percent": 28.57,
                "sale_price": 180.0,
                "wholesale_price": 165.0,
                "wholesale_quantity": 12.0,
                "stock": 96.0,
                "min_stock": 24.0,
                "sell_type": "unit",
                "tax_rate": 18.0,
                "department_id": dept_map.get("Bebidas")
            },
            {
                "barcode": "74601002",
                "name": "Cerveza Presidente Regular 355ml (Pequeña)",
                "cost_price": 95.0,
                "margin_percent": 26.31,
                "sale_price": 120.0,
                "wholesale_price": 110.0,
                "wholesale_quantity": 24.0,
                "stock": 144.0,
                "min_stock": 24.0,
                "sell_type": "unit",
                "tax_rate": 18.0,
                "department_id": dept_map.get("Bebidas")
            },
            {
                "barcode": "74601003",
                "name": "Refresco Coca Cola 2 Litros Retornable",
                "cost_price": 75.0,
                "margin_percent": 33.33,
                "sale_price": 100.0,
                "wholesale_price": 90.0,
                "wholesale_quantity": 8.0,
                "stock": 48.0,
                "min_stock": 12.0,
                "sell_type": "unit",
                "tax_rate": 18.0,
                "department_id": dept_map.get("Bebidas")
            },
            {
                "barcode": "74601004",
                "name": "Botellón de Agua Planeta Azul 5 Galones",
                "cost_price": 60.0,
                "margin_percent": 50.0,
                "sale_price": 90.0,
                "wholesale_price": 80.0,
                "wholesale_quantity": 5.0,
                "stock": 35.0,
                "min_stock": 10.0,
                "sell_type": "unit",
                "tax_rate": 0.0,
                "department_id": dept_map.get("Bebidas")
            },
            # Abarrotes
            {
                "barcode": "74602001",
                "name": "Arroz Selecto Campos (Por Libra)",
                "cost_price": 32.0,
                "margin_percent": 25.0,
                "sale_price": 40.0,
                "wholesale_price": 36.0,
                "wholesale_quantity": 25.0,
                "stock": 250.0,
                "min_stock": 50.0,
                "sell_type": "bulk",
                "tax_rate": 0.0,
                "department_id": dept_map.get("Abarrotes")
            },
            {
                "barcode": "74602002",
                "name": "Aceite Crisol de Soya 64oz",
                "cost_price": 280.0,
                "margin_percent": 25.0,
                "sale_price": 350.0,
                "wholesale_price": 325.0,
                "wholesale_quantity": 6.0,
                "stock": 30.0,
                "min_stock": 6.0,
                "sell_type": "unit",
                "tax_rate": 18.0,
                "department_id": dept_map.get("Abarrotes")
            },
            {
                "barcode": "74602003",
                "name": "Habichuelas Rojas Don Pedro 800g",
                "cost_price": 85.0,
                "margin_percent": 29.41,
                "sale_price": 110.0,
                "wholesale_price": 100.0,
                "wholesale_quantity": 10.0,
                "stock": 42.0,
                "min_stock": 10.0,
                "sell_type": "unit",
                "tax_rate": 0.0,
                "department_id": dept_map.get("Abarrotes")
            },
            {
                "barcode": "74602004",
                "name": "Café Santo Domingo 1 Libra (453g)",
                "cost_price": 220.0,
                "margin_percent": 27.27,
                "sale_price": 280.0,
                "wholesale_price": 260.0,
                "wholesale_quantity": 12.0,
                "stock": 55.0,
                "min_stock": 12.0,
                "sell_type": "unit",
                "tax_rate": 18.0,
                "department_id": dept_map.get("Abarrotes")
            },
            # Lácteos y Embutidos
            {
                "barcode": "74603001",
                "name": "Salami Mallita Especial Induveca (Libra)",
                "cost_price": 110.0,
                "margin_percent": 31.81,
                "sale_price": 145.0,
                "wholesale_price": 130.0,
                "wholesale_quantity": 10.0,
                "stock": 60.0,
                "min_stock": 15.0,
                "sell_type": "bulk",
                "tax_rate": 18.0,
                "department_id": dept_map.get("Lácteos y Embutidos")
            },
            {
                "barcode": "74603002",
                "name": "Queso Cheddar Criollo Geovanny (Libra)",
                "cost_price": 175.0,
                "margin_percent": 31.42,
                "sale_price": 230.0,
                "wholesale_price": 210.0,
                "wholesale_quantity": 10.0,
                "stock": 35.0,
                "min_stock": 8.0,
                "sell_type": "bulk",
                "tax_rate": 18.0,
                "department_id": dept_map.get("Lácteos y Embutidos")
            },
            {
                "barcode": "74603003",
                "name": "Leche Rica Entera UHT 1 Litro",
                "cost_price": 65.0,
                "margin_percent": 23.07,
                "sale_price": 80.0,
                "wholesale_price": 74.0,
                "wholesale_quantity": 12.0,
                "stock": 72.0,
                "min_stock": 24.0,
                "sell_type": "unit",
                "tax_rate": 0.0,
                "department_id": dept_map.get("Lácteos y Embutidos")
            },
            # Snacks
            {
                "barcode": "74604001",
                "name": "Platanitos Criollitos Salados 50g",
                "cost_price": 18.0,
                "margin_percent": 38.88,
                "sale_price": 25.0,
                "wholesale_price": 22.0,
                "wholesale_quantity": 20.0,
                "stock": 80.0,
                "min_stock": 20.0,
                "sell_type": "unit",
                "tax_rate": 18.0,
                "department_id": dept_map.get("Snacks y Golosinas")
            },
            {
                "barcode": "74604002",
                "name": "Galletas Hatuey Clásica Paquete Familiar",
                "cost_price": 68.0,
                "margin_percent": 32.35,
                "sale_price": 90.0,
                "wholesale_price": 82.0,
                "wholesale_quantity": 10.0,
                "stock": 40.0,
                "min_stock": 10.0,
                "sell_type": "unit",
                "tax_rate": 18.0,
                "department_id": dept_map.get("Snacks y Golosinas")
            }
        ]

        for p in products_data:
            existing = db.query(Product).filter(Product.barcode == p["barcode"]).first()
            if not existing:
                prod = Product(**p)
                db.add(prod)
        db.commit()
        print(f"Catálogo dominicano cargado: {len(products_data)} productos.")
        print("¡Inicialización completada con éxito!")

    except Exception as e:
        print(f"Error en seed_data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
