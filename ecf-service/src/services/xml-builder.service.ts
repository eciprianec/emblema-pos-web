import { create } from 'xmlbuilder2';
import { InvoiceRequest } from '../types';
import { config } from '../config';

export class XMLBuilderService {
  /**
   * Construye el XML de la factura electrónica en el formato exigido por DGII
   * Cumple con la especificación oficial de e-CF (República Dominicana):
   * - TablaFormasPago con elementos FormaDePago
   * - Códigos numéricos de FormaPago (1 a 8)
   * - IndicadorBienoServicio (1=Bien, 2=Servicio) con minúscula 'o'
   * - Soporte de Notas de Crédito E34 con InformacionReferencia
   * @param data Datos de la factura en formato JSON
   * @returns String con el XML estructurado
   */
  public buildECF(data: InvoiceRequest): string {
    const today = new Date().toISOString().split('T')[0];
    
    // Cálculo de subtotales e impuestos
    let montoGravadoTotal = 0;
    let montoExentoTotal = 0;
    let totalITBIS = 0;
    let montoTotal = 0;

    const itemsData = data.items.map((item, index) => {
      const montoItem = item.cantidad * item.precioUnitario;
      let itbisMonto = 0;

      if (item.tasaItbis > 0) {
        montoGravadoTotal += montoItem;
        itbisMonto = montoItem * (item.tasaItbis / 100);
        totalITBIS += itbisMonto;
      } else {
        montoExentoTotal += montoItem;
      }

      montoTotal += montoItem;

      // IndicadorBienoServicio: 1 = Bien, 2 = Servicio (Estándar oficial DGII)
      const isServicio = item.itemType === 'servicio' || item.esBien === false;
      const indicadorBienOServicio = isServicio ? 2 : 1;

      return {
        NumeroLinea: index + 1,
        IndicadorFacturacion: item.tasaItbis > 0 ? 1 : 2, // 1 = Gravado, 2 = Exento
        NombreItem: item.nombre,
        IndicadorBienoServicio: indicadorBienOServicio,
        CantidadItem: item.cantidad,
        PrecioUnitarioItem: item.precioUnitario.toFixed(2),
        MontoItem: montoItem.toFixed(2),
      };
    });

    montoTotal += totalITBIS;

    // Construcción de la Tabla de Formas de Pago DGII
    // 1: Efectivo
    // 2: Cheque / Transferencia / Depósito
    // 3: Tarjeta Débito / Crédito
    // 4: Venta a Crédito
    // 5: Bonos o Certificados de Regalo
    // 6: Permuta
    // 7: Nota de Crédito
    // 8: Otras Formas de Pago
    let formaDePagoArray: Array<{ FormaPago: number; MontoPago: string }> = [];

    if (data.formasPago && data.formasPago.length > 0) {
      formaDePagoArray = data.formasPago.map(p => ({
        FormaPago: Number(p.formaPago),
        MontoPago: Number(p.montoPago).toFixed(2),
      }));
    } else {
      let numericCode = 1; // Default: Efectivo
      if (data.formaPago !== undefined && data.formaPago !== null) {
        numericCode = parseInt(String(data.formaPago), 10) || 1;
      } else if (data.tipoPago === 2) {
        numericCode = 4; // Venta a crédito
      }
      formaDePagoArray = [{
        FormaPago: numericCode,
        MontoPago: montoTotal.toFixed(2),
      }];
    }

    const xmlObj: any = {
      ECF: {
        '@xmlns': 'https://dgii.gov.do/ecf',
        Encabezado: {
          Version: '1.0',
          IdDoc: {
            TipoeCF: data.tipoEcf,
            eNCF: data.encf,
            FechaVencimientoSecuencia: data.fechaVencimientoSecuencia,
            IndicadorNotaCredito: data.indicadorNotaCredito || (data.tipoEcf === '34' ? '1' : ''),
            IndicadorEnvioDiferido: '0',
            TipoIngresos: '01',
            TipoPago: data.tipoPago.toString(),
            FechaLimitePago: '',
            TerminoPago: '',
            TablaFormasPago: {
              FormaDePago: formaDePagoArray
            }
          },

          Emisor: {
            RNCEmisor: config.emisor.rnc,
            RazonSocialEmisor: config.emisor.razonSocial,
            NombreComercial: config.emisor.nombreComercial,
            DireccionEmisor: config.emisor.direccion,
            MunicipioEmisor: config.emisor.municipio,
            ProvinciaEmisor: config.emisor.provincia,
            FechaEmision: today,
          },
          Comprador: {
            RNCComprador: data.comprador.rnc,
            RazonSocialComprador: data.comprador.razonSocial,
          },
          Totales: {
            MontoGravadoTotal: montoGravadoTotal.toFixed(2),
            MontoGravadoI1: montoGravadoTotal.toFixed(2),
            MontoExento: montoExentoTotal.toFixed(2),
            ITBIS1: data.items.find(i => i.tasaItbis > 0)?.tasaItbis.toString() || '0',
            TotalITBIS1: totalITBIS.toFixed(2),
            TotalITBIS: totalITBIS.toFixed(2),
            MontoTotal: montoTotal.toFixed(2),
          }
        },
        DetallesItems: {
          Item: itemsData
        }
      }
    };

    // Si es Nota de Crédito (E34) o tiene comprobante modificado, agregar InformacionReferencia
    if (data.ncfModificado) {
      xmlObj.ECF.InformacionReferencia = {
        NCFModificado: data.ncfModificado,
        RNCOtroContribuyente: '',
        FechaNCFModificado: today,
        CodigoModificacion: 1 // 1 = Anula totalmente el comprobante / Corrección
      };
    }

    const doc = create({ version: '1.0', encoding: 'UTF-8' }, xmlObj);
    return doc.end({ prettyPrint: true });
  }
}
