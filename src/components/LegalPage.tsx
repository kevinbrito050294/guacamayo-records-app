import { ArrowLeft, Mail, MessageCircle, ShieldCheck, Scale } from 'lucide-react';
import type { ReactNode } from 'react';
import { EMAIL_CONTACTO, WHATSAPP_PEDIDOS, WHATSAPP_PEDIDOS_URL } from '../lib/contacto';

interface LegalPageProps {
  onBack: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white sm:text-2xl">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}

export function LegalPage({ onBack }: LegalPageProps) {
  return (
    <main className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-12">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <header className="bg-slate-950 px-5 py-8 text-white sm:px-10 sm:py-12">
          <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-amber-400">
            <ArrowLeft size={16} /> Volver a la tienda
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">Guacamayo Records</p>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-5xl">Información legal</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Privacidad, cobros, reembolsos, propiedad intelectual y canales de contacto.</p>
        </header>

        <div className="space-y-10 p-5 sm:p-10">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
            Este documento es informativo y debe ser revisado y adaptado por un profesional legal antes de usarlo como contrato definitivo. Deben completarse los datos del titular, domicilio, CUIT, jurisdicción y correo legal.
          </div>

          <Section title="1. Responsable y contacto">
            <p>El sitio es operado por Guacamayo Records. Para consultas sobre pedidos, privacidad o derechos podés escribir a <a className="font-bold text-amber-600 hover:underline" href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a>.</p>
            <p>Para consultas de compra y coordinación de pedidos está disponible WhatsApp: <a className="font-bold text-amber-600 hover:underline" href={WHATSAPP_PEDIDOS_URL} target="_blank" rel="noreferrer">+{WHATSAPP_PEDIDOS}</a>.</p>
          </Section>

          <Section title="2. Datos personales y almacenamiento">
            <p>Podemos tratar nombre, email, contraseña protegida mediante hash, teléfono o WhatsApp, direcciones de envío, favoritos, pedidos, preferencias de divisa y datos técnicos de sesión.</p>
            <p>Los datos se utilizan para crear y administrar cuentas, procesar pedidos, coordinar entregas, responder consultas, recuperar cuentas, prevenir abusos y mejorar la operación del sitio. No almacenamos números completos de tarjetas en esta aplicación.</p>
            <p>La información puede almacenarse en la base de datos administrada mediante Railway/MySQL. Para recuperación de cuentas podemos utilizar Resend y, si el usuario lo habilita, Google OAuth. Cada proveedor debe revisarse y documentarse según la configuración final de producción.</p>
            <p>Las sesiones se gestionan mediante cookies httpOnly. Conservamos los datos mientras exista la cuenta o sea necesario para cumplir obligaciones, resolver reclamos, prevenir fraude o mantener registros operativos. Podés solicitar acceso, rectificación, actualización o eliminación escribiendo al contacto indicado, sujeto a las obligaciones legales aplicables.</p>
          </Section>

          <Section title="3. Cobros y pagos">
            <p>Actualmente el pedido se registra en el sitio y el equipo coordina con el cliente los datos de pago mediante WhatsApp. La cotización mostrada puede estar expresada en USD, ARS o USDT según la configuración vigente, y debe confirmarse antes del pago.</p>
            <p>En una etapa futura podremos incorporar Mercado Pago u otro proveedor. Cuando eso ocurra, el pago se procesará en la plataforma del proveedor, se informarán las condiciones antes de confirmar y no se almacenarán credenciales ni datos completos de tarjetas en Guacamayo Records.</p>
            <p>La confirmación de un pedido no implica por sí sola que el pago haya sido aprobado. El pedido quedará sujeto a disponibilidad, validación del importe, acreditación del pago y coordinación de entrega.</p>
          </Section>

          <Section title="4. Cancelaciones y reembolsos">
            <p>Antes de implementar pagos directos, las cancelaciones y devoluciones se coordinan caso por caso por WhatsApp, considerando el estado del pedido, la disponibilidad del producto y si el pago fue acreditado.</p>
            <p>Cuando exista integración con Mercado Pago, los reembolsos se tramitarán por el medio de pago original cuando sea técnicamente posible y quedarán sujetos a los plazos, retenciones, contracargos y reglas del proveedor. Los costos de envío, productos dañados por un uso incorrecto y pedidos ya entregados podrán tener condiciones diferentes, que se informarán antes de la compra.</p>
            <p>La cancelación interna del pedido puede devolver stock, cupones o recompensas, pero eso no equivale automáticamente a un reembolso monetario: el dinero se devuelve únicamente por el canal que lo haya cobrado.</p>
          </Section>

          <Section title="5. Inteligencia artificial y derechos de autor">
            <p>Guacamayo Records puede haber sido desarrollado con asistencia de herramientas de inteligencia artificial para programación, redacción, diseño, documentación y análisis. La IA es una herramienta de apoyo: las decisiones finales, integración, revisión y publicación corresponden a personas responsables del proyecto.</p>
            <p>La marca, el código original, la estructura visual, los textos propios, las fotografías producidas para el proyecto y demás materiales originales pertenecen a sus respectivos titulares y están protegidos por las normas de propiedad intelectual aplicables. No se autoriza copiar, redistribuir, entrenar modelos ni reutilizar comercialmente esos materiales sin permiso.</p>
            <p>Las portadas, marcas, nombres de artistas, imágenes de terceros y otros contenidos pertenecen a sus titulares. Si considerás que algún material infringe derechos, escribí a <a className="font-bold text-amber-600 hover:underline" href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a> con la identificación del contenido y la justificación del reclamo.</p>
          </Section>

          <section className="grid gap-3 sm:grid-cols-3" aria-label="Canales de contacto">
            <a href={`mailto:${EMAIL_CONTACTO}`} className="rounded-2xl border border-slate-200 p-4 transition-colors hover:border-amber-500 dark:border-slate-700">
              <Mail className="mb-3 text-amber-500" size={22} />
              <strong className="block text-sm text-slate-900 dark:text-white">Correo</strong>
              <span className="mt-1 block break-all text-xs text-slate-500">{EMAIL_CONTACTO}</span>
            </a>
            <a href={WHATSAPP_PEDIDOS_URL} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 p-4 transition-colors hover:border-emerald-500 dark:border-slate-700">
              <MessageCircle className="mb-3 text-emerald-500" size={22} />
              <strong className="block text-sm text-slate-900 dark:text-white">Pedidos por WhatsApp</strong>
              <span className="mt-1 block text-xs text-slate-500">+{WHATSAPP_PEDIDOS}</span>
            </a>
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <ShieldCheck className="mb-3 text-blue-500" size={22} />
              <strong className="block text-sm text-slate-900 dark:text-white">Privacidad</strong>
              <span className="mt-1 block text-xs text-slate-500">Solicitudes por email</span>
            </div>
          </section>

          <p className="flex items-start gap-2 border-t border-slate-200 pt-6 text-xs leading-5 text-slate-500 dark:border-slate-800"><Scale size={16} className="mt-0.5 shrink-0 text-amber-500" /> Última actualización: octubre de 2026. Esta información debe actualizarse cuando se incorporen pagos directos, analítica, nuevos proveedores o datos legales del titular.</p>
        </div>
      </div>
    </main>
  );
}
