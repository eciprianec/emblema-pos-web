from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import engine, Base, ensure_schema_upgrades
from .routes import (
    auth,
    ventas,
    clientes,
    productos,
    inventarios,
    compras,
    cortes,
    reportes,
    dgii,
    config
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crear todas las tablas en la base de datos si no existen
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades()
    print("Base de datos SQLite inicializada y esquema actualizado para Emblema POS Web.")
    yield

app = FastAPI(
    title="Emblema POS Web - API",
    description="Backend completo del Sistema de Punto de Venta y Facturación Electrónica e-CF DGII (Ley 32-23 República Dominicana)",
    version="1.0.0",
    lifespan=lifespan
)

# Configuración de CORS amplia para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router con prefijo /api
api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(ventas.router)
api_router.include_router(clientes.router)
api_router.include_router(productos.router)
api_router.include_router(inventarios.router)
api_router.include_router(compras.router)
api_router.include_router(cortes.router)
api_router.include_router(reportes.router)
api_router.include_router(dgii.router)
api_router.include_router(config.router)

app.include_router(api_router)

# Soporte directo sin /api por compatibilidad
app.include_router(auth.router)
app.include_router(ventas.router)
app.include_router(clientes.router)
app.include_router(productos.router)
app.include_router(inventarios.router)
app.include_router(compras.router)
app.include_router(cortes.router)
app.include_router(reportes.router)
app.include_router(dgii.router)
app.include_router(config.router)

@app.get("/")
def root():
    return {
        "sistema": "Emblema POS Web",
        "descripcion": "Sistema de Punto de Venta Web con Facturación Electrónica DGII",
        "estado": "Operativo",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "ok", "service": "emblema-pos-backend"}
