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

export interface ItemDetail {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  esBien: boolean;
  tasaItbis: number;
}

export interface InvoiceRequest {
  tipoEcf: string; // ej. "31", "32"
  encf: string;    // ej. "E310000000001"
  fechaVencimientoSecuencia: string; // ej. "31-12-2025"
  tipoPago: number; // 1 = Contado, 2 = Crédito
  formaPago: string; // ej. "01" (Efectivo), "02" (Cheque)
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
}


export interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
}
