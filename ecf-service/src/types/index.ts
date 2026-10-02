export interface Emisor {
  rnc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccion: string;
  municipio: string;
  provincia: string;
  telefono?: string;
  email?: string;
}

export interface Comprador {
  rnc: string;
  razonSocial: string;
  direccion?: string;
  municipio?: string;
  provincia?: string;
}

export interface PaymentDetail {
  formaPago: number; // 1: Efectivo, 2: Cheque/Transf, 3: Tarjeta, 4: Crédito, 5: Bonos, 6: Permuta, 7: Nota Crédito, 8: Otras
  montoPago: number;
  referencia?: string;
}

export interface ItemDetail {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  itemType?: 'bien' | 'servicio';
  esBien?: boolean;
  tasaItbis: number;
}

export interface InvoiceRequest {
  tipoEcf: string; // ej. "31", "32", "34"
  encf: string;    // ej. "E310000000001", "E32...", "E34..."
  fechaVencimientoSecuencia: string; // ej. "31-12-2026"
  indicadorNotaCredito?: string;
  ncfModificado?: string; // Para Notas de Crédito E34
  tipoPago: number; // 1 = Contado, 2 = Crédito
  formaPago?: number | string; // Compatibilidad con código único legacy
  formasPago?: PaymentDetail[]; // Desglose multi-pago normalizado
  comprador: Comprador;
  items: ItemDetail[];
}

export interface ECFResponse {
  success: boolean;
  trackId?: string;
  status?: string;
  error?: string;
  codigoSeguridad?: string;
  securityCode?: string;
  xml?: string;
}


export interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
}
