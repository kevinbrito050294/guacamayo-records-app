import { Pedido, DetallePedido, ViniloCatalogo, PreciosConvertidos } from '../types/database';

export function generarMensajeWhatsApp(
  pedido: Pedido,
  detalles: Array<DetallePedido & { vinilo: ViniloCatalogo }>,
  precios: PreciosConvertidos,
  whatsappNumber: string
): string {
  const lineaDetalles = detalles
    .map(
      (d) =>
        `• ${d.vinilo.artista} - ${d.vinilo.titulo} (${d.cantidad}x) - $${d.subtotal_usd.toFixed(2)} USD`
    )
    .join('\n');

  const mensaje = `Hola! Quisiera confirmar esta orden:

📦 *Pedido #${pedido.numero_pedido}*

${lineaDetalles}

💰 *Total:*
• USD: $${precios.usd.toFixed(2)}
• ARS: $${precios.ars.toFixed(2)}
• USDT: ${precios.usdt.toFixed(4)}

Por favor, confirmar disponibilidad y forma de pago.

¡Gracias!`;

  const encodedMessage = encodeURIComponent(mensaje);
  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodedMessage}`;

  return whatsappUrl;
}

export function abrirWhatsApp(url: string) {
  window.open(url, '_blank');
}
