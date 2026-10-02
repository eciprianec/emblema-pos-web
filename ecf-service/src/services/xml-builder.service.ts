import { create } from 'xmlbuilder2';
import { InvoiceRequest } from '../types';
import { config } from '../config';

export class XMLBuilderService {
  /**
   * Construye el XML de la factura electrónica en el formato exigido por DGII
   * @param data Datos de la factura en formato JSON
   * @returns String con el XML estructurado
   */
  public buildECF(data: InvoiceRequest): string {
    const today = new Date().toISOString().split('T')[0];
    
    // Cálculo de totales
    let montoGravadoTotal = 0;
    let totalITBIS = 0;
    let montoTotal = 0;

    const itemsData = data.items.map((item, index) => {
      const montoItem = item.cantidad * item.precioUnitario;
      let itbisMonto = 0;

      if (item.tasaItbis > 0) {
        montoGravadoTotal += montoItem;
        itbisMonto = montoItem * (item.tasaItbis / 100);
        totalITBIS += itbisMonto;
      }

      montoTotal += montoItem;

      return {
        NumeroLinea: index + 1,
        IndicadorFacturacion: item.tasaItbis > 0 ? 1 : 2, // 1 = Gravado, 2 = Exento
        NombreItem: item.nombre,
        IndicadorBienOServicio: item.esBien !== false ? 1 : 2, // 1 = Bien (por defecto en POS), 2 = Servicio
        CantidadItem: item.cantidad,
        PrecioUnitarioItem: item.precioUnitario.toFixed(2),
        MontoItem: montoItem.toFixed(2),
      };
    });

    montoTotal += totalITBIS;

    const formaPagoFinal = data.formaPago || (data.tipoPago === 1 ? '01' : '02');

    const xmlObj: any = {
      ECF: {
        '@xmlns': 'https://dgii.gov.do/ecf',
        Encabezado: {
          Version: '1.0',
          IdDoc: {
            TipoeCF: data.tipoEcf,
            eNCF: data.encf,
            FechaVencimientoSecuencia: data.fechaVencimientoSecuencia,
            IndicadorNotaCredito: '',
            IndicadorEnvioDiferido: '0',
            TipoIngresos: '01',
            TipoPago: data.tipoPago.toString(),
            FechaLimitePago: '',
            TerminoPago: '',
            TablaFormasPago: {
              FormaPago: {
                FormaPago: formaPagoFinal,
                MontoPago: montoTotal.toFixed(2),
              }
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

    const doc = create({ version: '1.0', encoding: 'UTF-8' }, xmlObj);
    return doc.end({ prettyPrint: true });
  }
}
