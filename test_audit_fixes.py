import httpx
import sys

BASE_URL = "http://localhost:8001/api"
client = httpx.Client(timeout=10.0)

def test_audit():
    print(">> INICIANDO VERIFICACIÓN DE LAS CORRECCIONES DE AUDITORÍA...", flush=True)
    
    # 1. Login Admin y Login Cajero
    r_admin = client.post(f"{BASE_URL}/auth/login", json={"username_or_email": "admin", "password": "Admin1234*"})
    assert r_admin.status_code == 200, f"Error login admin: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]
    
    r_cajero = client.post(f"{BASE_URL}/auth/login", json={"username_or_email": "cajero", "password": "Cajero1234*"})
    assert r_cajero.status_code == 200, f"Error login cajero: {r_cajero.text}"
    cajero_token = r_cajero.json()["access_token"]
    
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    headers_cajero = {"Authorization": f"Bearer {cajero_token}"}
    
    print("[1/5] Autenticación de Admin y Cajero verificada.", flush=True)

    # 2. Probar restricción de permisos en backend para Cajero (Debe responder HTTP 403 Forbidden)
    # 2a. Descarga de Backup sin permiso
    r_backup_cajero = client.get(f"{BASE_URL}/config/backup/download", headers=headers_cajero)
    assert r_backup_cajero.status_code == 403, f"Se esperaba 403 pero se obtuvo {r_backup_cajero.status_code}"
    
    # 2b. Ajuste de Inventario sin permiso
    r_adj_cajero = client.post(f"{BASE_URL}/inventarios/adjust", json={"product_id": 1, "new_quantity": 50, "reason": "ajuste"}, headers=headers_cajero)
    assert r_adj_cajero.status_code == 403, f"Se esperaba 403 pero se obtuvo {r_adj_cajero.status_code}"
    
    # 2c. Cancelación de venta sin permiso
    r_cancel_cajero = client.post(f"{BASE_URL}/ventas/cancel/1", headers=headers_cajero)
    assert r_cancel_cajero.status_code == 403, f"Se esperaba 403 pero se obtuvo {r_cancel_cajero.status_code}"
    
    print("[2/5] Seguridad en backend verificada: los cajeros sin permisos reciben HTTP 403 Forbidden.", flush=True)

    # 3. Probar Venta con Múltiples Métodos de Pago (Multi-Payment)
    barcode_mp = "74609999901"
    client.post(f"{BASE_URL}/productos", json={
        "barcode": barcode_mp,
        "name": "Producto Prueba MultiPago",
        "sale_price": 1000.0,
        "tax_rate": 18.0,
        "stock": 20.0
    }, headers=headers_admin)
    
    sale_payload = {
        "client_name": "Consumidor MultiPago",
        "ncf_type": "E32",
        "payment_method": "mixed",
        "payments": {
            "cash": 600.0,
            "card": 400.0,
            "transfer": 0.0,
            "credit": 0.0
        },
        "cash_received": 600.0,
        "send_to_dgii": False,
        "items": [
            {
                "barcode": barcode_mp,
                "name": "Producto Prueba MultiPago",
                "quantity": 1.0,
                "unit_price": 1000.0,
                "tax_rate": 18.0
            }
        ]
    }
    r_sale = client.post(f"{BASE_URL}/ventas/sale", json=sale_payload, headers=headers_admin)
    assert r_sale.status_code == 200, f"Error en venta multi-pago: {r_sale.text}"
    sale_data = r_sale.json()
    assert sale_data["payment_cash"] == 600.0, f"payment_cash incorrecto: {sale_data.get('payment_cash')}"
    assert sale_data["payment_card"] == 400.0, f"payment_card incorrecto: {sale_data.get('payment_card')}"
    assert sale_data["total"] == 1000.0, f"total incorrecto: {sale_data.get('total')}"
    
    print(f"[3/5] Venta Multi-pago registrada correctamente (Efectivo: RD${sale_data['payment_cash']}, Tarjeta: RD${sale_data['payment_card']}).", flush=True)

    # 4. Probar descarga de respaldo seguro usando SQLite Online Backup API
    r_backup_admin = client.get(f"{BASE_URL}/config/backup/download", headers=headers_admin)
    assert r_backup_admin.status_code == 200, f"Error en backup admin: {r_backup_admin.status_code}"
    assert len(r_backup_admin.content) > 10000, "El archivo de respaldo está vacío o incompleto"
    assert r_backup_admin.content.startswith(b"SQLite format 3"), "La cabecera del archivo no es SQLite format 3"
    
    print("[4/5] Snapshot en caliente de SQLite generado y verificado (Cabecera 'SQLite format 3' intacta).", flush=True)

    # 5. Probar Abono de Cliente con registro automático en movimiento de caja
    client.post(f"{BASE_URL}/cortes/open", json={"initial_cash": 1500.0}, headers=headers_admin)
    
    r_cli = client.post(f"{BASE_URL}/clientes", json={
        "name": "Cliente Prueba Abono",
        "credit_limit": 5000.0
    }, headers=headers_admin)
    cli_id = r_cli.json()["id"]
    
    r_fiado = client.post(f"{BASE_URL}/ventas/sale", json={
        "client_id": cli_id,
        "ncf_type": "E32",
        "payment_method": "credit",
        "send_to_dgii": False,
        "items": [{
            "barcode": barcode_mp,
            "name": "Producto Prueba MultiPago",
            "quantity": 0.5,
            "unit_price": 1000.0,
            "tax_rate": 0.0
        }]
    }, headers=headers_admin)
    assert r_fiado.status_code == 200, f"Error fiado: {r_fiado.text}"
    
    r_abono = client.post(f"{BASE_URL}/clientes/{cli_id}/abono", json={"amount": 200.0, "notes": "Abono test"}, headers=headers_admin)
    assert r_abono.status_code == 200, f"Error abono: {r_abono.text}"
    assert r_abono.json()["receipt"]["remaining_balance"] == 300.0, f"Saldo incorrecto: {r_abono.json()}"
    
    r_movs = client.get(f"{BASE_URL}/cortes/movements", headers=headers_admin)
    assert r_movs.status_code == 200
    movs = r_movs.json()
    abono_mov_found = any("Abono El Fiado" in m.get("reason", "") for m in movs)
    assert abono_mov_found, "El abono no generó movimiento de entrada en la sesión de caja"
    
    print("[5/5] Abono de crédito conciliado exitosamente con la sesión activa de caja.", flush=True)
    print("=" * 65, flush=True)
    print(">> TODAS LAS PRUEBAS DE AUDITORÍA FUERON SUPERADAS CON ÉXITO (5/5 PASS)", flush=True)
    print("=" * 65, flush=True)

if __name__ == "__main__":
    try:
        test_audit()
    except Exception as e:
        print(f"FAILED: {e}", flush=True)
        sys.exit(1)
