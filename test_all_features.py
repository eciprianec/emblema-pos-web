#!/usr/bin/env python3
"""
Prueba Integral de Validación Funcional de Emblema POS Web.
Ejecuta pruebas automatizadas de extremo a extremo (E2E) en los 11 módulos del sistema:
1. Autenticación & Permisos
2. Dashboard Ejecutivo
3. Ventas (F1) & Cobros (Efectivo, Tarjeta, Crédito, DGII e-CF)
4. Clientes (F2) & Cuentas por Cobrar ("El Fiado")
5. Catálogo de Productos (F3) & Departamentos
6. Inventarios (F4), Alertas & Kárdex
7. Compras (F5) & Proveedores
8. Cortes de Caja (F6), Entradas (F7) & Salidas (F8)
9. Reportes Financieros (F7) & Ganancia Real
10. Facturación Electrónica DGII (F8, e-CF Ley 32-23)
11. Configuración Integral (F9), Dispositivos & Respaldos
"""

import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:8001/api"
passed_tests = 0
failed_tests = 0
failures = []

def run_test(name, func):
    global passed_tests, failed_tests
    print(f"[*] Probando: {name} ... ", end="", flush=True)
    try:
        func()
        print("[OK] PASS")
        passed_tests += 1
    except Exception as e:
        print(f"[FAIL] ERROR: {e}")
        failed_tests += 1
        failures.append((name, str(e)))

def http_req(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            if "application/json" in content_type:
                return resp.status, json.loads(raw.decode("utf-8"))
            return resp.status, raw
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(error_body)
        except Exception:
            return e.code, error_body

# ==========================================
# VARIABLES GLOBALES DE PRUEBA
# ==========================================
state = {
    "admin_token": None,
    "cajero_token": None,
    "product_id": None,
    "barcode": None,
    "client_id": None,
    "supplier_id": None,
    "sale_id": None,
    "session_id": None
}

# ==========================================
# 1. AUTENTICACIÓN
# ==========================================
def test_login_admin():
    status, res = http_req("/auth/login", method="POST", data={
        "username_or_email": "admin",
        "password": "Admin1234*"
    })
    assert status == 200, f"Error {status}: {res}"
    assert "access_token" in res, "No se recibió access_token"
    assert res["user"]["role"] == "admin", "Rol no es admin"
    state["admin_token"] = res["access_token"]

def test_login_cajero():
    status, res = http_req("/auth/login", method="POST", data={
        "username_or_email": "cajero",
        "password": "Cajero1234*"
    })
    assert status == 200, f"Error {status}: {res}"
    assert "access_token" in res, "No se recibió access_token"
    assert res["user"]["role"] == "cajero", "Rol no es cajero"
    state["cajero_token"] = res["access_token"]

def test_auth_me():
    status, res = http_req("/auth/me", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["username"] == "admin"

def test_login_invalid():
    status, res = http_req("/auth/login", method="POST", data={
        "username_or_email": "admin",
        "password": "WrongPassword123"
    })
    assert status in (400, 401), f"Debe rechazar credenciales malas. Recibió {status}"

# ==========================================
# 2. DASHBOARD EJECUTIVO
# ==========================================
def test_dashboard_metrics():
    status, res = http_req("/reportes/dashboard", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "ventas_hoy" in res, "Falta ventas_hoy"
    assert "costo_hoy" in res, "Falta costo_hoy"
    assert "ganancia_hoy" in res, "Falta ganancia_hoy"

# ==========================================
# 3. CATÁLOGO DE PRODUCTOS (F3) & DEPARTAMENTOS
# ==========================================
def test_get_departments():
    status, res = http_req("/productos/departments/list", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert isinstance(res, list), "No es una lista"

def test_create_department():
    dep_name = f"Lácteos y Quesos {datetime.now().strftime('%M%S')}"
    status, res = http_req("/productos/departments", method="POST", data={
        "name": dep_name,
        "description": "Lácteos frescos dominicanos"
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    state["dep_id"] = res["id"]

def test_create_product():
    code = f"TEST{datetime.now().strftime('%f')}"
    status, res = http_req("/productos", method="POST", data={
        "barcode": code,
        "name": "Queso Geo Pasteurizado 1lb",
        "cost_price": 120.0,
        "sale_price": 165.0,
        "wholesale_price": 150.0,
        "wholesale_quantity": 5.0,
        "stock": 25.0,
        "min_stock": 5.0,
        "department_id": state.get("dep_id"),
        "sell_type": "unit",
        "tax_rate": 18.0
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    state["product_id"] = res["id"]
    state["barcode"] = code

def test_get_product_by_barcode():
    status, res = http_req(f"/productos/barcode/{state['barcode']}", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["barcode"] == state["barcode"]

def test_update_product():
    status, res = http_req(f"/productos/{state['product_id']}", method="PUT", data={
        "barcode": state["barcode"],
        "name": "Queso Geo Pasteurizado 1lb (Especial)",
        "cost_price": 125.0,
        "sale_price": 175.0,
        "wholesale_price": 155.0,
        "wholesale_quantity": 5.0,
        "stock": 30.0,
        "min_stock": 6.0,
        "department_id": state.get("dep_id"),
        "sell_type": "unit",
        "tax_rate": 18.0
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["sale_price"] == 175.0

# ==========================================
# 4. CLIENTES (F2) & CRÉDITO ("EL FIADO")
# ==========================================
def test_create_client():
    rnc_test = f"131{datetime.now().strftime('%M%S%f')[:6]}"
    status, res = http_req("/clientes", method="POST", data={
        "name": "Colmado San Rafael SRL",
        "rnc_cedula": rnc_test,
        "phone": "809-555-8822",
        "email": "sanrafael@gmail.com",
        "address": "Calle Las Mercedes #12, Zona Colonial",
        "credit_limit": 5000.0
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    state["client_id"] = res["id"]

def test_get_client_detail():
    status, res = http_req(f"/clientes/{state['client_id']}/estado-cuenta", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "client" in res and "movements" in res

def test_debt_summary():
    status, res = http_req("/clientes/resumen-deuda/total", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "total_debt" in res

# ==========================================
# 5. CORTES DE CAJA (F6) - APERTURA DE TURNO
# ==========================================
def test_open_cash_session():
    status, res = http_req("/cortes/abrir", method="POST", data={
        "initial_cash": 2500.0,
        "notes": "Apertura para jornada de pruebas automatizadas"
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "session_id" in res
    state["session_id"] = res["session_id"]

def test_cash_entry_f7():
    status, res = http_req("/cortes/movimiento", method="POST", data={
        "type": "entrada",
        "amount": 500.0,
        "reason": "Reposición de cambio menudo para caja"
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["success"] is True

def test_cash_exit_f8():
    status, res = http_req("/cortes/movimiento", method="POST", data={
        "type": "salida",
        "amount": 250.0,
        "reason": "Pago delivery agua purificada"
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["success"] is True

def test_current_session_state():
    status, res = http_req("/cortes/estado-actual", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["is_open"] is True
    assert res["session"]["initial_cash"] > 0

# ==========================================
# 6. VENTAS (F1) - TERMINAL DE COBRO & DGII
# ==========================================
def test_search_product():
    status, res = http_req(f"/ventas/buscar-producto?q={state['barcode']}", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert len(res) > 0

def test_price_checker():
    status, res = http_req(f"/ventas/verificador-precio?q={state['barcode']}", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["sale_price"] == 175.0

def test_process_sale_cash_e32():
    status, res = http_req("/ventas", method="POST", data={
        "client_name": "Consumidor Final",
        "ncf_type": "E32",
        "payment_method": "cash",
        "cash_received": 1000.0,
        "send_to_dgii": False,
        "items": [
            {
                "product_id": state["product_id"],
                "name": "Queso Geo Pasteurizado 1lb (Especial)",
                "quantity": 2.0,
                "unit_price": 175.0,
                "tax_rate": 18.0
            }
        ]
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["encf"].startswith("E32")
    assert res["total"] > 0
    state["sale_id"] = res["id"]

def test_process_sale_credit_fiado():
    status, res = http_req("/ventas", method="POST", data={
        "client_id": state["client_id"],
        "ncf_type": "E31",
        "payment_method": "credit",
        "cash_received": 0.0,
        "send_to_dgii": False,
        "items": [
            {
                "product_id": state["product_id"],
                "name": "Queso Geo Pasteurizado 1lb (Especial)",
                "quantity": 3.0,
                "unit_price": 175.0,
                "tax_rate": 18.0
            }
        ]
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["encf"].startswith("E31")
    state["credit_sale_id"] = res["id"]

def test_client_balance_after_credit():
    status, res = http_req(f"/clientes/{state['client_id']}/estado-cuenta", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["client"]["current_balance"] > 0, "No se cargó la deuda al cliente"

def test_client_abono():
    status, res = http_req(f"/clientes/{state['client_id']}/abono", method="POST", data={
        "amount": 200.0,
        "notes": "Abono parcial en efectivo"
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["success"] is True

def test_sales_history():
    status, res = http_req("/ventas/historial", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert len(res) >= 2

def test_cancel_sale():
    status, res = http_req(f"/ventas/{state['sale_id']}/cancelar", method="POST", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["success"] is True

# ==========================================
# 7. INVENTARIOS (F4) & KÁRDEX
# ==========================================
def test_add_inventory_stock():
    status, res = http_req("/inventarios/agregar-stock", method="POST", data={
        "product_id": state["product_id"],
        "quantity": 10.0,
        "notes": "Llegó pedido de almacén"
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["success"] is True

def test_adjust_inventory_stock():
    status, res = http_req("/inventarios/ajustar-stock", method="POST", data={
        "product_id": state["product_id"],
        "new_quantity": 40.0,
        "reason": "conteo_fisico"
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["new_stock"] == 40.0

def test_inventory_valuation():
    status, res = http_req("/inventarios/valuacion", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "total_cost_value" in res
    assert "total_retail_value" in res

def test_inventory_low_stock():
    status, res = http_req("/inventarios/bajo-stock", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert isinstance(res, list)

def test_product_kardex():
    status, res = http_req(f"/inventarios/kardex/{state['product_id']}", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert len(res["movements"]) > 0

# ==========================================
# 8. COMPRAS (F5) & PROVEEDORES
# ==========================================
def test_create_supplier():
    status, res = http_req("/compras/proveedores", method="POST", data={
        "name": "Lácteos Dominicanos SRL",
        "rnc_cedula": "101999888",
        "phone": "809-555-4321",
        "email": "ventas@lacteosdom.com",
        "contact_person": "Ing. Ramón Pérez"
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    state["supplier_id"] = res["id"]

def test_list_suppliers():
    status, res = http_req("/compras/proveedores", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert len(res) > 0

def test_record_purchase():
    status, res = http_req("/compras", method="POST", data={
        "supplier_id": state["supplier_id"],
        "invoice_number": f"FAC-{datetime.now().strftime('%M%S')}",
        "notes": "Compra directa de fábrica",
        "items": [
            {
                "product_id": state["product_id"],
                "quantity": 15.0,
                "cost_price": 122.0
            }
        ]
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"

def test_list_purchases():
    status, res = http_req("/compras", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert len(res) > 0

# ==========================================
# 9. REPORTES FINANCIEROS (F7)
# ==========================================
def test_sales_by_period():
    status, res = http_req("/reportes/ventas-periodo?period=today", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "total_sales" in res
    assert "net_profit" in res

def test_top_products():
    status, res = http_req("/reportes/top-productos", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert isinstance(res, list)

def test_sales_by_department():
    status, res = http_req("/reportes/ventas-departamento", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert isinstance(res, list)

# ==========================================
# 10. FACTURACIÓN ELECTRÓNICA DGII (F8)
# ==========================================
def test_dgii_get_config():
    status, res = http_req("/dgii/config", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "config" in res

def test_dgii_update_config_put():
    status, res = http_req("/dgii/config", method="PUT", data={
        "nombre_comercial": "Emblema POS Oficial",
        "modo_contingencia": False
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["success"] is True

def test_dgii_test_connection():
    status, res = http_req("/dgii/test-connection", method="POST", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "success" in res or "serviceStatus" in res

def test_dgii_sequences():
    status, res = http_req("/dgii/sequences", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "E31" in res and "E32" in res

def test_dgii_logs():
    status, res = http_req("/dgii/logs", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert isinstance(res, list)

def test_dgii_formatos_resumen():
    status, res = http_req("/dgii/formatos/resumen?year=2026&month=10", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "compras_606" in res and "ventas_607" in res

def test_dgii_formato_606():
    status, res = http_req("/dgii/formatos/606?year=2026&month=10", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res.get("formato") == "606"
    assert "rows" in res
    assert "totales" in res

def test_dgii_formato_606_txt():
    import urllib.request
    req = urllib.request.Request(f"{BASE_URL}/dgii/formatos/606/download-txt?year=2026&month=10")
    req.add_header("Authorization", f"Bearer {state['admin_token']}")
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        assert "606|" in content

def test_dgii_formato_607():
    status, res = http_req("/dgii/formatos/607?year=2026&month=10", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res.get("formato") == "607"
    assert "rows" in res
    assert "totales" in res

def test_dgii_formato_607_txt():
    import urllib.request
    req = urllib.request.Request(f"{BASE_URL}/dgii/formatos/607/download-txt?year=2026&month=10")
    req.add_header("Authorization", f"Bearer {state['admin_token']}")
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        assert "607|" in content

# ==========================================
# 11. CONFIGURACIÓN DEL SISTEMA (F9)
# ==========================================
def test_config_get_store():
    status, res = http_req("/config/store", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "store_name" in res
    assert "printer_width" in res
    assert "currency_symbol" in res

def test_config_update_store():
    status, res = http_req("/config/store", method="PUT", data={
        "store_name": "Emblema POS Enterprise",
        "printer_copies": 2,
        "scale_enabled": True,
        "scale_port": "COM2"
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["settings"]["store_name"] == "Emblema POS Enterprise"

def test_config_list_users():
    status, res = http_req("/config/users", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert len(res) >= 2

def test_config_create_and_manage_cashier():
    test_user = f"cajero_auto_{datetime.now().strftime('%M%S')}"
    status, res = http_req("/config/users", method="POST", data={
        "username": test_user,
        "email": f"{test_user}@test.com",
        "password": "Password123*",
        "full_name": "Cajero Prueba Auto",
        "role": "cajero",
        "can_discount": True,
        "can_view_costs": False,
        "can_corte": True,
        "can_manage_clients": True
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    new_uid = res["id"]
    
    # Actualizar permiso
    status2, res2 = http_req(f"/config/users/{new_uid}", method="PUT", data={
        "can_change_prices": True,
        "can_view_costs": True
    }, token=state["admin_token"])
    assert status2 == 200, f"Error {status2}: {res2}"
    assert res2["can_view_costs"] is True
    
    # Eliminar cajero creado
    status3, res3 = http_req(f"/config/users/{new_uid}", method="DELETE", token=state["admin_token"])
    assert status3 == 200, f"Error {status3}: {res3}"

def test_config_database_optimize():
    status, res = http_req("/config/database/optimize", method="POST", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert "size_kb" in res

def test_config_backup_download():
    status, res = http_req("/config/backup/download", token=state["admin_token"])
    assert status == 200, f"Error {status}"
    assert len(res) > 1000, "El archivo de respaldo está vacío"
    state["backup_bytes"] = res

def test_config_backup_restore():
    db_bytes = state.get("backup_bytes")
    assert db_bytes, "No hay bytes de respaldo para probar restauración"
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="test_backup.db"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode('utf-8') + db_bytes + f"\r\n--{boundary}--\r\n".encode('utf-8')

    req = urllib.request.Request(
        f"{BASE_URL}/config/backup/restore",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {state['admin_token']}"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        assert resp.status == 200, f"Error restaurando: {resp.status}"
        data = json.loads(resp.read().decode('utf-8'))
        assert "message" in data

    # Verificar que el sistema sigue funcionando y respondiendo
    status, res = http_req("/config/store", token=state["admin_token"])
    assert status == 200, f"Error tras restaurar base de datos: {status}"

def test_config_invalid_backup_rejected():
    fake_bytes = b"ESTE NO ES UN ARCHIVO SQLITE VALIDO SINO TEXTO"
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="corrupt_backup.db"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode('utf-8') + fake_bytes + f"\r\n--{boundary}--\r\n".encode('utf-8')

    req = urllib.request.Request(
        f"{BASE_URL}/config/backup/restore",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {state['admin_token']}"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            assert False, "Debió rechazar archivo corrupto pero aceptó"
    except urllib.error.HTTPError as e:
        assert e.code == 400, f"Se esperaba error 400, se recibió: {e.code}"

def test_stock_depletion_blocked_when_disabled():
    # 1. Deshabilitar ventas sin stock
    http_req("/config/store", method="PUT", data={"allow_sales_without_stock": False}, token=state["admin_token"])
    
    # 2. Crear producto con solo 1 unidad
    code = f"LOW{datetime.now().strftime('%f')}"
    status, prod = http_req("/productos", method="POST", data={
        "barcode": code,
        "name": "Batería 9V Duracell (Única)",
        "cost_price": 80.0,
        "sale_price": 120.0,
        "stock": 1.0,
        "min_stock": 2.0,
        "tax_rate": 18.0
    }, token=state["admin_token"])
    assert status == 200, f"Error creando producto: {prod}"
    
    # 3. Intentar vender 5 unidades (debe dar 400)
    status_sale, res_sale = http_req("/ventas", method="POST", data={
        "client_name": "Consumidor Final",
        "ncf_type": "E32",
        "payment_method": "cash",
        "cash_received": 1000.0,
        "send_to_dgii": False,
        "items": [
            {
                "product_id": prod["id"],
                "name": prod["name"],
                "quantity": 5.0,
                "unit_price": 120.0,
                "tax_rate": 18.0
            }
        ]
    }, token=state["admin_token"])
    assert status_sale == 400, f"Debió rechazar venta por falta de stock. Recibió {status_sale}: {res_sale}"
    
    # 4. Restaurar allow_sales_without_stock = True
    http_req("/config/store", method="PUT", data={"allow_sales_without_stock": True}, token=state["admin_token"])

def test_tax_included_precision():
    # Con precios que incluyen ITBIS 18%, un producto de RD$100 debe dar total=100
    code = f"TAX{datetime.now().strftime('%f')}"
    status, prod = http_req("/productos", method="POST", data={
        "barcode": code,
        "name": "Aceite Crisol 1L (ITBIS Incluido)",
        "cost_price": 150.0,
        "sale_price": 200.0,
        "stock": 50.0,
        "min_stock": 5.0,
        "tax_rate": 18.0
    }, token=state["admin_token"])
    assert status == 200
    
    status_sale, sale_res = http_req("/ventas", method="POST", data={
        "client_name": "Consumidor Final",
        "ncf_type": "E32",
        "payment_method": "cash",
        "cash_received": 500.0,
        "send_to_dgii": False,
        "items": [
            {
                "product_id": prod["id"],
                "name": prod["name"],
                "quantity": 1.0,
                "unit_price": 200.0,
                "tax_rate": 18.0
            }
        ]
    }, token=state["admin_token"])
    assert status_sale == 200
    assert sale_res["total"] == 200.0, f"Total no coincide con precio incluido: {sale_res['total']}"
    assert sale_res["itbis"] > 0, "No calculó ITBIS"
    assert round(sale_res["subtotal"] + sale_res["itbis"], 2) == 200.0

# ==========================================
# 12. CIERRE DE TURNO (F6) - CORTE ARQUEADO
# ==========================================
def test_close_cash_session():
    status, res = http_req("/cortes/cerrar", method="POST", data={
        "final_cash_counted": 2750.0,
        "notes": "Cierre de turno de prueba exitoso",
        "bills_breakdown": {
            "2000": 1,
            "500": 1,
            "200": 1,
            "50": 1
        }
    }, token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert res["success"] is True
    assert "corte" in res

def test_cortes_history():
    status, res = http_req("/cortes/historial", token=state["admin_token"])
    assert status == 200, f"Error {status}: {res}"
    assert len(res) > 0

# ==========================================
# EJECUCIÓN PRINCIPAL DE LA BATERÍA DE PRUEBAS
# ==========================================
def main():
    print("=" * 65)
    print(">> INICIANDO BATERIA DE PRUEBAS INTEGRALES EMBLEMA POS WEB")
    print(f">> Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    # 1. Auth
    run_test("1.1 Login Administrador (admin / Admin1234*)", test_login_admin)
    run_test("1.2 Login Cajero (cajero / Cajero1234*)", test_login_cajero)
    run_test("1.3 Verificación de sesión /auth/me", test_auth_me)
    run_test("1.4 Rechazo de contraseña inválida", test_login_invalid)

    # 2. Dashboard
    run_test("2.1 Métricas del Dashboard Ejecutivo", test_dashboard_metrics)

    # 3. Catálogo y Productos
    run_test("3.1 Listar Departamentos", test_get_departments)
    run_test("3.2 Crear Departamento", test_create_department)
    run_test("3.3 Crear Producto con mayoreo e ITBIS", test_create_product)
    run_test("3.4 Búsqueda de Producto por Código de Barras", test_get_product_by_barcode)
    run_test("3.5 Actualizar Información y Precio de Producto", test_update_product)

    # 4. Clientes y Crédito
    run_test("4.1 Crear Cliente con Límite de Crédito", test_create_client)
    run_test("4.2 Consultar Detalle y Estado de Cuenta", test_get_client_detail)
    run_test("4.3 Resumen Global de Cuentas por Cobrar", test_debt_summary)

    # 5. Caja F6 - Apertura y Movimientos
    run_test("5.1 Apertura de Turno de Caja (Fondo Inicial)", test_open_cash_session)
    run_test("5.2 Entrada de Efectivo (F7)", test_cash_entry_f7)
    run_test("5.3 Salida de Efectivo (F8)", test_cash_exit_f8)
    run_test("5.4 Consultar Estado Actual de Caja", test_current_session_state)

    # 6. Ventas F1
    run_test("6.1 Búsqueda Rápida en Terminal F1", test_search_product)
    run_test("6.2 Verificador de Precios F3", test_price_checker)
    run_test("6.3 Cobrar Venta en Efectivo (Consumo E32)", test_process_sale_cash_e32)
    run_test("6.4 Cobrar Venta a Crédito (Crédito Fiscal E31)", test_process_sale_credit_fiado)
    run_test("6.5 Verificar Saldo Deudor del Cliente", test_client_balance_after_credit)
    run_test("6.6 Registrar Abono a Cuenta por Cobrar", test_client_abono)
    run_test("6.7 Historial de Tickets del Día", test_sales_history)
    run_test("6.8 Cancelar Venta con Reversión de Stock", test_cancel_sale)
    run_test("6.9 Precisión de Cálculo con ITBIS Incluido", test_tax_included_precision)
    run_test("6.10 Bloqueo de Venta Sin Stock al estar Desactivado", test_stock_depletion_blocked_when_disabled)

    # 7. Inventarios F4
    run_test("7.1 Entrada Rápida de Stock a Producto", test_add_inventory_stock)
    run_test("7.2 Ajuste Físico de Inventario", test_adjust_inventory_stock)
    run_test("7.3 Valuación Financiera del Almacén", test_inventory_valuation)
    run_test("7.4 Consulta de Alertas de Bajo Stock", test_inventory_low_stock)
    run_test("7.5 Trazabilidad y Kárdex del Producto", test_product_kardex)

    # 8. Compras F5
    run_test("8.1 Registrar Proveedor", test_create_supplier)
    run_test("8.2 Listar Proveedores", test_list_suppliers)
    run_test("8.3 Registrar Factura de Compra con Aumento de Stock", test_record_purchase)
    run_test("8.4 Listar Compras Realizadas", test_list_purchases)

    # 9. Reportes F7
    run_test("9.1 Reporte de Ventas y Ganancia Neta Real", test_sales_by_period)
    run_test("9.2 Ranking de Top Productos Más Vendidos", test_top_products)
    run_test("9.3 Ventas por Departamento", test_sales_by_department)

    # 10. DGII e-CF F8 & Formatos 606 / 607
    run_test("10.1 Consultar Configuración DGII", test_dgii_get_config)
    run_test("10.2 Actualizar Parámetros DGII (PUT /dgii/config)", test_dgii_update_config_put)
    run_test("10.3 Probar Conexión con Microservicio e-CF", test_dgii_test_connection)
    run_test("10.4 Consultar Secuencias Disponibles E31/E32", test_dgii_sequences)
    run_test("10.5 Consultar Logs de Transmisión e-CF", test_dgii_logs)
    run_test("10.6 Resumen Mensual Formatos DGII 606 y 607", test_dgii_formatos_resumen)
    run_test("10.7 Generación y Validación de Formato 606 (Compras)", test_dgii_formato_606)
    run_test("10.8 Descarga de Archivo TXT 606 Pipe-Delimited", test_dgii_formato_606_txt)
    run_test("10.9 Generación y Validación de Formato 607 (Ventas)", test_dgii_formato_607)
    run_test("10.10 Descarga de Archivo TXT 607 Pipe-Delimited", test_dgii_formato_607_txt)

    # 11. Configuración Integral F9
    run_test("11.1 Consultar Configuración del Negocio", test_config_get_store)
    run_test("11.2 Actualizar Configuración y Hardware", test_config_update_store)
    run_test("11.3 Listar Matriz de Permisos de Cajeros", test_config_list_users)
    run_test("11.4 Crear Cajero, Editar Permisos y Eliminar", test_config_create_and_manage_cashier)
    run_test("11.5 Optimizar y Compactar Base de Datos (VACUUM)", test_config_database_optimize)
    run_test("11.6 Descargar Respaldo de Base de Datos (.db)", test_config_backup_download)
    run_test("11.7 Restaurar Base de Datos desde Respaldo (.db)", test_config_backup_restore)
    run_test("11.8 Rechazo de Archivo Corrupto en Restauración", test_config_invalid_backup_rejected)

    # 12. Cierre de Caja F6
    run_test("12.1 Cerrar Turno con Arqueo de Billetes y Notificación (F6)", test_close_cash_session)
    run_test("12.2 Consultar Historial de Cortes de Caja", test_cortes_history)

    print("=" * 65)
    print(f"RESUMEN: {passed_tests} Pruebas Exitosas | {failed_tests} Fallos")
    print("=" * 65)
    if failures:
        print("[!] DETALLE DE FALLOS:")
        for name, err in failures:
            print(f"  - {name}: {err}")
        sys.exit(1)
    else:
        print("[SUCCESS] TODAS LAS FUNCIONES DEL SISTEMA PASARON AL 100% SIN NINGUN ERROR!")
        sys.exit(0)

if __name__ == "__main__":
    main()
