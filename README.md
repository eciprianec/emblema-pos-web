# Emblema POS Web - Punto de Venta & Facturación Electrónica DGII

Sistema integral de **Punto de Venta (POS) y Facturación Electrónica (e-CF)** adaptado a la legislación fiscal de la **República Dominicana (Ley 32-23 y Norma General 07-2018 de la DGII)**.

---

## 🚀 Características Principales

### 1. Terminal de Ventas (F1)
- **Multi-tickets simultáneos**: atienda varios clientes en paralelo sin perder ventas pendientes.
- **Búsqueda inteligente**: por escáner de código de barras (EAN-13), SKU o descripción con autocompletado instantáneo.
- **Sintaxis de multiplicador rápido**: soporte para cantidades directas (ej: `5*74601001` o `2.5*arroz`).
- **Verificador de precios (F3)**: consulta rápida de precios y stock sin salir de la pantalla de venta.
- **Cálculo fiscal dominicano**: soporte de ITBIS al 18% (tanto precios con impuesto incluido como desglosado).
- **Múltiples métodos de pago**: Efectivo con cálculo de cambio, Tarjetas (Débito/Crédito), Transferencia Bancaria y Venta a Crédito ("El Fiado").

### 2. Facturación Electrónica DGII (e-CF - Ley 32-23)
- **Comprobantes Electrónicos**:
  - `E31`: Factura de Crédito Fiscal.
  - `E32`: Factura de Consumo.
  - `E33` / `E34`: Notas de Débito y Crédito electrónicas.
- **Microservicio e-CF integrado**: timbrado en tiempo real, firma digital con certificados `.p12`, cálculo de código de seguridad de 6 dígitos y consulta de `trackId`.
- **Modo Contingencia**: emisión y resguardo local en caso de intermitencia con el portal DGII.

### 3. Formatos Oficiales DGII 606 y 607 (Norma 07-2018)
- **Formato 606 (Compras de Bienes y Servicios)**:
  - Generación mensual automatizada de las 23 columnas requeridas por la DGII.
  - Clasificación de tipo de gastos (01 a 11, costo de venta 09).
  - Cálculo de ITBIS adelantable, sujeto a proporcionalidad y retenciones (ISR/ITBIS).
  - Descarga directa en formato oficial **TXT delimitado por plecas (`|`)** y exportación a Excel / CSV.
- **Formato 607 (Ventas e Ingresos)**:
  - Generación de las 23 columnas oficiales de ventas.
  - **Cuadre matemático al 100%**: validación estricta de que la suma de formas de pago coincide exactamente con el monto facturado + ITBIS.
  - Descarga directa en formato oficial **TXT delimitado por plecas (`|`)** y Excel / CSV.

### 4. Clientes y Cuentas por Cobrar (F2)
- Gestión de clientes con RNC o Cédula dominicana.
- Asignación de límites de crédito y seguimiento de balances deudores en tiempo real.
- Registro de abonos parciales o totales con historial cronológico de movimientos.

### 5. Catálogo de Productos y Departamentos (F3)
- Administración de productos por unidad, a granel / peso (libras/kilos) o paquetes.
- Precios de mayoreo por volumen de compra.
- Calculadora de precios integrada basada en margen de ganancia porcentual o costo neto.

### 6. Control de Inventarios y Kárdex (F4)
- Entradas rápidas de mercancía y ajustes físicos de inventario.
- Valuación financiera del almacén (costo vs. precio de venta vs. utilidad proyectada).
- Alertas visuales de stock mínimo y bajo inventario.
- Kárdex cronológico de trazabilidad por producto (ventas, compras, ajustes, cancelaciones).

### 7. Compras y Proveedores (F5)
- Registro de proveedores locales con RNC y datos de contacto.
- Registro de facturas de compra con incremento automático de existencias y actualización del último costo.
- Captura de datos tributarios para inclusión directa en el reporte 606.

### 8. Control de Caja y Cortes de Turno (F6)
- Apertura de turno con fondo inicial de caja.
- Entradas de efectivo (F7) y salidas para gastos operativos (F8).
- Cierre de turno con arqueo desglosado de billetes y monedas (RD$ 2,000, 1,000, 500, 200, 100, 50, 25, 10, 5, 1).
- Notificación automática por correo electrónico (SMTP) al propietario del negocio al realizar cada corte.

### 9. Reportes Financieros y Ganancia Neta Real (F7)
- Cálculo de ganancia neta real (Venta - Costo real de cada artículo vendido).
- Ventas del día, ranking de productos más vendidos y distribución por departamento.

### 10. Configuración del Negocio, Hardware y Respaldos (F9)
- Personalización de datos del negocio para tickets térmicos (80mm / 58mm).
- Apertura automática de cajón de dinero e integración con báscula y lector de códigos de barra.
- Matriz de permisos por cajero (descuentos, ver costos, modificar inventario, corte, cancelar ventas).
- Copias de seguridad de la base de datos en 1-clic con descarga y restauración protegida contra archivos corruptos.
- Herramienta de compactación y optimización de base de datos (`VACUUM`).

---

## 🛠️ Arquitectura Técnica

```text
┌────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│     Frontend Web       │ ───> │       Backend API       │ ───> │   Microservicio e-CF    │
│ React 18, TailwindCSS  │      │   FastAPI, SQLAlchemy   │      │ Node.js, Express, TS    │
│ Atajos F1-F9 (Port 3000)│     │ SQLite WAL (Port 8001)  │      │  dgii-ecf (Port 3001)   │
└────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

---

## 📦 Puesta en Marcha

### Requisitos Previos
- **Node.js**: v18 o superior
- **Python**: v3.10 o superior
- **Git**

### 1. Clonar el Repositorio
```bash
git clone https://github.com/eciprianec/emblema-pos-web.git
cd emblema-pos-web
```

### 2. Backend (FastAPI)
```bash
cd backend
python -m venv venv

# En Windows:
.\venv\Scripts\activate
# En Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Microservicio Fiscal DGII e-CF
```bash
cd ecf-service
npm install
npm run build
npm start
```

### 4. Frontend Web
```bash
cd frontend
npm install
npm run build
# Para desarrollo:
npm start
# O para producción:
npx serve -s build -l 3000
```

---

## 🧪 Pruebas Automatizadas E2E

El proyecto cuenta con una suite integral de **59 pruebas automatizadas** que validan la totalidad de los módulos:

```bash
python test_all_features.py
```

Resultado de ejecución:
```text
=================================================================
>> INICIANDO BATERIA DE PRUEBAS INTEGRALES EMBLEMA POS WEB
=================================================================
RESUMEN: 59 Pruebas Exitosas | 0 Fallos
[SUCCESS] TODAS LAS FUNCIONES DEL SISTEMA PASARON AL 100% SIN NINGUN ERROR!
=================================================================
```

---

## 🔐 Credenciales Predeterminadas

| Usuario | Contraseña | Rol | Alcance |
| :--- | :--- | :--- | :--- |
| **`admin`** | **`Admin1234*`** | Administrador | Control total de todos los módulos y ajustes |
| **`cajero`** | **`Cajero1234*`** | Cajero | Terminal de ventas, clientes, cobros y corte |

---

## 📄 Licencia y Créditos
Desarrollado para comercios y empresas de República Dominicana. Cumple con los requerimientos técnicos y normativos vigentes de la DGII.
