import React from 'react';

import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const footerLinks = {
  Plataforma: ['Cursos', 'Instructores', 'Planes', 'En Vivo'],
  Soporte: ['Centro de Ayuda', 'Contacto', 'Estado del Servicio'],
  Legal: ['Términos de Uso', 'Privacidad', 'Cookies'],
};

export default function LandingFooter() {
  return (
    <footer className="border-t border-border py-16">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AppLogo size={32} />
              <span className="font-extrabold text-lg text-foreground">Glewstudio</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              La plataforma de fotografía profesional para estudiantes que quieren resultados reales.
            </p>
            <div className="flex items-center gap-3">
              {['instagram', 'youtube', 'twitter']?.map((social) => (
                <a
                  key={`social-${social}`}
                  href="#"
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  aria-label={social}
                >
                  <Icon name="GlobeAltIcon" size={14} />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks)?.map(([section, links]) => (
            <div key={`footer-section-${section}`}>
              <h4 className="text-sm font-700 text-foreground mb-4">{section}</h4>
              <ul className="flex flex-col gap-2.5">
                {links?.map((link) => (
                  <li key={`footer-link-${link}`}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 Glewstudio. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="ShieldCheckIcon" size={14} className="text-primary" />
            <span>Pagos seguros con Stripe · SSL encriptado</span>
          </div>
        </div>
      </div>
    </footer>
  );
}