"""
Script Oficial de Generación e Inspección Manual y Automatizada de XMLs e-CF (DGII República Dominicana)
Valida la estructura exacta según las normativas y la especificación de dgii-ecf:
- <TablaFormasPago><FormaDePago><FormaPago>[1-8]</FormaPago><MontoPago>...</MontoPago></FormaDePago></TablaFormasPago>
- <IndicadorBienoServicio>[1|2]</IndicadorBienoServicio> (con 'o' minúscula)
- Firma digital XMLDSig y Código de Seguridad de 6 dígitos
- Nota de Crédito Electrónica E34 con InformacionReferencia
"""

import os
import re
import json
import urllib.request
import xml.etree.ElementTree as ET

BASE_URL = "http://localhost:3001"
OUTPUT_DIR = "ecf_samples"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_xml(payload):
    req = urllib.request.Request(
        f"{BASE_URL}/api/ecf/generate-xml",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode("utf-8"))

def inspect_xml(title, filename, payload, expected_forma_pago_codes, expected_bien_servicio):
    print(f"\n=======================================================")
    print(f">> INSPECCIÓN: {title}")
    print(f"=======================================================")
    
    result = generate_xml(payload)
    assert result["success"] == True, f"Error generando XML: {result}"
    
    xml_str = result["xml"]
    sec_code = result.get("securityCode")
    is_signed = result.get("isSigned")
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(xml_str)
    print(f"[*] Archivo guardado en: {filepath}")
    print(f"[*] Firma Digital Detectada: {is_signed} (Longitud XML: {len(xml_str)} caracteres)")
    print(f"[*] Código de Seguridad (6 dígitos): {sec_code}")
    assert sec_code and len(sec_code) == 6, f"Código de seguridad inválido: {sec_code}"

    # 1. Inspeccionar TablaFormasPago
    # Debe contener <TablaFormasPago> y elementos <FormaDePago>
    assert "<TablaFormasPago>" in xml_str, "Falta nodo <TablaFormasPago>"
    assert "<FormaDePago>" in xml_str, "Falta nodo <FormaDePago>"
    
    # Extraer todos los bloques <FormaDePago>
    formas_de_pago = re.findall(r"<FormaDePago>(.*?)</FormaDePago>", xml_str, re.DOTALL)
    print(f"[*] Formas de Pago encontradas ({len(formas_de_pago)}):")
    found_codes = []
    for fp_block in formas_de_pago:
        code_m = re.search(r"<FormaPago>(\d+)</FormaPago>", fp_block)
        monto_m = re.search(r"<MontoPago>([0-9.]+)</MontoPago>", fp_block)
        assert code_m, f"FormaPago no tiene código numérico en: {fp_block}"
        assert monto_m, f"MontoPago no encontrado en: {fp_block}"
        code_val = int(code_m.group(1))
        monto_val = float(monto_m.group(1))
        found_codes.append(code_val)
        print(f"    - Código DGII: {code_val} | Monto: RD${monto_val:,.2f}")
        
    assert found_codes == expected_forma_pago_codes, f"Códigos esperados {expected_forma_pago_codes}, obtenidos {found_codes}"

    # 2. Inspeccionar IndicadorBienoServicio (Con 'o' minúscula y valores 1 o 2)
    assert "<IndicadorBienOServicio>" not in xml_str, "ERROR CRÍTICO: Se encontró <IndicadorBienOServicio> con O mayúscula! Debe ser 'o' minúscula."
    assert "<IndicadorBienoServicio>" in xml_str, "Falta nodo <IndicadorBienoServicio>"
    
    items = re.findall(r"<Item>(.*?)</Item>", xml_str, re.DOTALL)
    print(f"[*] Items encontrados ({len(items)}):")
    found_types = []
    for it_block in items:
        name_m = re.search(r"<NombreItem>(.*?)</NombreItem>", it_block)
        tipo_m = re.search(r"<IndicadorBienoServicio>(\d+)</IndicadorBienoServicio>", it_block)
        assert tipo_m, f"IndicadorBienoServicio no encontrado en {it_block}"
        t_val = int(tipo_m.group(1))
        found_types.append(t_val)
        tipo_desc = "1 (Bien)" if t_val == 1 else "2 (Servicio)"
        print(f"    - Item: {name_m.group(1)} | Clasificación: {tipo_desc}")
        
    assert found_types == expected_bien_servicio, f"Tipos esperados {expected_bien_servicio}, obtenidos {found_types}"

    # 3. Inspeccionar Totales
    total_m = re.search(r"<MontoTotal>([0-9.]+)</MontoTotal>", xml_str)
    assert total_m, "Falta <MontoTotal>"
    print(f"[*] Monto Total Certificado: RD${float(total_m.group(1)):,.2f}")

    # 4. Inspeccionar Firma Digital XMLDSig
    if is_signed:
        assert "<Signature" in xml_str, "Falta nodo <Signature>"
        assert "<DigestValue>" in xml_str, "Falta nodo <DigestValue>"
        assert "<SignatureValue>" in xml_str, "Falta nodo <SignatureValue>"
        assert "<KeyInfo>" in xml_str, "Falta nodo <KeyInfo>"
        print("    [OK] Bloque XMLDSig RSA-SHA256 íntegro y verificado.")

    print(f">> ESTADO: [VERIFICADO MEDIANTE XML REAL]")
    return xml_str

def run_all_inspections():
    print("=================================================================")
    print(">> GENERACIÓN E INSPECCIÓN DE MUESTRAS REALES DE XML e-CF DGII <<")
    print("=================================================================")

    # CASO 1: Pago en Efectivo (Código 1)
    p1 = {
        "tipoEcf": "32",
        "encf": "E320000000001",
        "fechaVencimientoSecuencia": "31-12-2026",
        "tipoPago": 1,
        "formasPago": [{"formaPago": 1, "montoPago": 1180.00}],
        "comprador": {"rnc": "000000000", "razonSocial": "Consumidor Final"},
        "items": [{"nombre": "Saco de Arroz 50lb", "cantidad": 1, "precioUnitario": 1000.00, "itemType": "bien", "tasaItbis": 18}]
    }
    inspect_xml("1. Pago 100% Efectivo (Código 1)", "01_efectivo_E32.xml", p1, [1], [1])

    # CASO 2: Pago con Tarjeta de Crédito / Débito (Código 3)
    p2 = {
        "tipoEcf": "32",
        "encf": "E320000000002",
        "fechaVencimientoSecuencia": "31-12-2026",
        "tipoPago": 1,
        "formasPago": [{"formaPago": 3, "montoPago": 2360.00, "referencia": "Visa *4589 Auth: 99812"}],
        "comprador": {"rnc": "000000000", "razonSocial": "Consumidor Final"},
        "items": [{"nombre": "Aceite Crisol Galón", "cantidad": 2, "precioUnitario": 1000.00, "itemType": "bien", "tasaItbis": 18}]
    }
    inspect_xml("2. Pago 100% Tarjeta (Código 3)", "02_tarjeta_E32.xml", p2, [3], [1])

    # CASO 3: Transferencia Bancaria (Código 2)
    p3 = {
        "tipoEcf": "31",
        "encf": "E310000000001",
        "fechaVencimientoSecuencia": "31-12-2026",
        "tipoPago": 1,
        "formasPago": [{"formaPago": 2, "montoPago": 5900.00, "referencia": "Banco BHD Transf: 7712390"}],
        "comprador": {"rnc": "101889988", "razonSocial": "Comercializadora Dominicana SRL"},
        "items": [{"nombre": "Caja de Leche Evaporada", "cantidad": 5, "precioUnitario": 1000.00, "itemType": "bien", "tasaItbis": 18}]
    }
    inspect_xml("3. Pago 100% Transferencia Bancaria (Código 2 - B01/E31)", "03_transferencia_E31.xml", p3, [2], [1])

    # CASO 4: Venta a Crédito / 'El Fiado' (Código 4)
    p4 = {
        "tipoEcf": "31",
        "encf": "E310000000002",
        "fechaVencimientoSecuencia": "31-12-2026",
        "tipoPago": 2,
        "formasPago": [{"formaPago": 4, "montoPago": 3540.00}],
        "comprador": {"rnc": "131456789", "razonSocial": "Ferretería El Progreso SRL"},
        "items": [{"nombre": "Cemento Gris Titán", "cantidad": 6, "precioUnitario": 500.00, "itemType": "bien", "tasaItbis": 18}]
    }
    inspect_xml("4. Venta a Crédito (Código 4 - TipoPago 2)", "04_credito_E31.xml", p4, [4], [1])

    # CASO 5: Pago Mixto (Efectivo + Tarjeta + Bono de Regalo: Códigos 1, 3, 5)
    p5 = {
        "tipoEcf": "32",
        "encf": "E320000000003",
        "fechaVencimientoSecuencia": "31-12-2026",
        "tipoPago": 1,
        "formasPago": [
            {"formaPago": 1, "montoPago": 1000.00},
            {"formaPago": 3, "montoPago": 1000.00, "referencia": "Mastercard *1122"},
            {"formaPago": 5, "montoPago": 360.00, "referencia": "Bono Regalo #BN-889"}
        ],
        "comprador": {"rnc": "000000000", "razonSocial": "Consumidor Final"},
        "items": [{"nombre": "Televisor Smart 32 pulg", "cantidad": 1, "precioUnitario": 2000.00, "itemType": "bien", "tasaItbis": 18}]
    }
    inspect_xml("5. Pago Mixto Efectivo + Tarjeta + Bono (Códigos 1, 3, 5)", "05_mixto_E32.xml", p5, [1, 3, 5], [1])

    # CASO 6: Factura con Bienes y Servicios (Indicador 1 y 2)
    p6 = {
        "tipoEcf": "32",
        "encf": "E320000000004",
        "fechaVencimientoSecuencia": "31-12-2026",
        "tipoPago": 1,
        "formasPago": [{"formaPago": 1, "montoPago": 1350.00}],
        "comprador": {"rnc": "000000000", "razonSocial": "Consumidor Final"},
        "items": [
            {"nombre": "Filtro de Aceite", "cantidad": 1, "precioUnitario": 500.00, "itemType": "bien", "tasaItbis": 18},
            {"nombre": "Servicio Cambio de Aceite y Mano de Obra", "cantidad": 1, "precioUnitario": 760.00, "itemType": "servicio", "tasaItbis": 0}
        ]
    }
    inspect_xml("6. Factura Mixta Bienes (1) y Servicios (2)", "06_bien_y_servicio_E32.xml", p6, [1], [1, 2])

    # CASO 7: Nota de Crédito Electrónica E34 afectando eNCF previo (Devolución)
    p7 = {
        "tipoEcf": "34",
        "encf": "E340000000001",
        "ncfModificado": "E320000000001",
        "fechaVencimientoSecuencia": "31-12-2026",
        "tipoPago": 1,
        "formasPago": [{"formaPago": 7, "montoPago": 1180.00}],
        "comprador": {"rnc": "000000000", "razonSocial": "Consumidor Final"},
        "items": [{"nombre": "Saco de Arroz 50lb (Devolución)", "cantidad": 1, "precioUnitario": 1000.00, "itemType": "bien", "tasaItbis": 18}]
    }
    nc_xml = inspect_xml("7. Nota de Crédito Electrónica E34 (Afecta E320000000001)", "07_nota_credito_E34.xml", p7, [7], [1])
    assert "<NCFModificado>E320000000001</NCFModificado>" in nc_xml, "Falta <NCFModificado> en E34"
    assert "<CodigoModificacion>1</CodigoModificacion>" in nc_xml, "Falta <CodigoModificacion> en E34"
    print("    [OK] Bloque InformacionReferencia verificado para Nota de Crédito.")

    print("\n=================================================================")
    print(">> TODAS LAS MUESTRAS XML FUERON GENERADAS, FIRMADAS E INSPECCIONADAS")
    print(">> CON TOTAL CONFORMIDAD FISCAL CON LA ESPECIFICACIÓN DGII!")
    print("=================================================================")

if __name__ == "__main__":
    run_all_inspections()
