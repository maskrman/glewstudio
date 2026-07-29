import React from 'react';
import CourseCarousel from '@/components/ui/CourseCarousel';

const continueWatching = [
{ id: 'cw-001', title: 'Iluminación Rembrandt para Retrato', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1d731ee8d-1779952599495.png", thumbnailAlt: 'Studio lighting setup with Rembrandt pattern creating dramatic shadows on portrait subject', duration: '14:32', tier: 'obturador' as const, progress: 65, lessonCount: 12, rating: 4.9 },
{ id: 'cw-002', title: 'Retoque de Piel en Photoshop CC', instructor: 'Sofía Reyes', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_189deaf40-1768079839052.png", thumbnailAlt: 'Professional photo retouching workflow showing skin smoothing techniques in Photoshop', duration: '22:15', tier: 'apertura' as const, progress: 30, lessonCount: 8, rating: 4.8 },
{ id: 'cw-003', title: 'Fotografía de Producto en Mesa de Luz', instructor: 'Sofía Reyes', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_18c3fcab2-1772196420648.png", thumbnailAlt: 'Elegant product photography on light table with minimalist composition', duration: '18:44', tier: 'apertura' as const, progress: 82, lessonCount: 10, rating: 4.7 },
{ id: 'cw-004', title: 'Color Grading Cinematográfico', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1e45302fc-1783851831373.png", thumbnailAlt: 'Color grading workflow in Lightroom with cinematic teal and orange look applied', duration: '31:20', tier: 'obturador' as const, progress: 15, lessonCount: 16, rating: 4.9 },
{ id: 'cw-005', title: 'Esquemas de Tres Puntos de Luz', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_113c48f0e-1772615974348.png", thumbnailAlt: 'Three-point lighting diagram with key light, fill light, and back light setup in studio', duration: '26:10', tier: 'obturador' as const, progress: 50, lessonCount: 14 }];


const studioLighting = [
{ id: 'sl-001', title: 'Luz Natural vs Luz Artificial en Estudio', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1cd7666ea-1785194270271.png", thumbnailAlt: 'Comparison of natural window light and artificial strobe light in photography studio', duration: '45:00', tier: 'apertura' as const, lessonCount: 18, rating: 4.8 },
{ id: 'sl-002', title: 'Softboxes, Paraguas y Modificadores', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_129426577-1785194268625.png", thumbnailAlt: 'Array of photography light modifiers including softboxes and octaboxes on studio floor', duration: '38:00', tier: 'obturador' as const, lessonCount: 14, rating: 4.9 },
{ id: 'sl-003', title: 'Luz de Borde y Contraluz Dramático', instructor: 'Valentina Cruz', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_18bddf107-1779534745027.png", thumbnailAlt: 'Dramatic back lighting creating rim light silhouette effect on model in studio', duration: '29:30', tier: 'obturador' as const, lessonCount: 10, rating: 4.7 },
{ id: 'sl-004', title: 'Flash de Alta Velocidad HSS', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_19c438e56-1772196420060.png", thumbnailAlt: 'High speed sync flash freezing motion of water droplet in professional studio setting', duration: '52:15', tier: 'diafragma' as const, lessonCount: 22, rating: 4.9 },
{ id: 'sl-005', title: 'Iluminación para Moda Editorial', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1c7111102-1785194268846.png", thumbnailAlt: 'Fashion editorial lighting setup with multiple strobe heads and colored gels', duration: '1h 10min', tier: 'diafragma' as const, lessonCount: 28, rating: 5.0 },
{ id: 'sl-006', title: 'Medición de Luz con Fotómetro', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa242636-1772528160793.png", thumbnailAlt: 'Photographer using handheld light meter in studio to measure exposure readings', duration: '22:00', tier: 'apertura' as const, lessonCount: 8, rating: 4.6 },
{ id: 'sl-007', title: 'Esquemas de Luz para Grupos', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_160cc6675-1785194268617.png", thumbnailAlt: 'Group portrait lighting diagram showing placement of multiple lights for even illumination', duration: '41:00', tier: 'obturador' as const, lessonCount: 16, rating: 4.8 }];


const editing = [
{ id: 'ed-001', title: 'Flujo de Trabajo RAW en Lightroom', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1538443b8-1785194268631.png", thumbnailAlt: 'Lightroom RAW workflow showing catalog organization and basic develop panel', duration: '1h 05min', tier: 'apertura' as const, lessonCount: 20, rating: 4.9 },
{ id: 'ed-002', title: 'Dodge & Burn Profesional', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1ec2f8cee-1785194269829.png", thumbnailAlt: 'Photoshop dodge and burn technique showing luminosity masking on portrait retouching', duration: '48:20', tier: 'obturador' as const, lessonCount: 14, rating: 4.8 },
{ id: 'ed-003', title: 'Mascaras de Luminosidad Avanzadas', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_10b9be016-1785194269817.png", thumbnailAlt: 'Advanced luminosity masking technique in Photoshop for selective color and tone control', duration: '55:00', tier: 'diafragma' as const, lessonCount: 18, rating: 4.9 },
{ id: 'ed-004', title: 'Presets de Lightroom desde Cero', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1b566eb3f-1774179779705.png", thumbnailAlt: 'Creating custom Lightroom presets from scratch showing develop module settings', duration: '35:45', tier: 'obturador' as const, lessonCount: 12, rating: 4.7 },
{ id: 'ed-005', title: 'Eliminación de Fondos con IA', instructor: 'Sofía Reyes', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_15e8f3edd-1785194268642.png", thumbnailAlt: 'AI-powered background removal tool in Photoshop removing complex hair strands', duration: '28:30', tier: 'apertura' as const, lessonCount: 8, rating: 4.6 }];


const productPhoto = [
{ id: 'pp-001', title: 'Fotografía de Joyería y Relojes', instructor: 'Sofía Reyes', thumbnail: "https://images.unsplash.com/photo-1642697601641-142b68190a91", thumbnailAlt: 'Macro product photography of luxury watch on reflective black surface', duration: '42:00', tier: 'obturador' as const, lessonCount: 16, rating: 4.9 },
{ id: 'pp-002', title: 'Gastronomía: Platos Calientes', instructor: 'Sofía Reyes', thumbnail: "https://images.unsplash.com/photo-1528267696449-7205ebc11414", thumbnailAlt: 'Food photography of steaming hot dishes with dramatic side lighting on dark background', duration: '37:15', tier: 'apertura' as const, lessonCount: 12, rating: 4.8 },
{ id: 'pp-003', title: 'Flat Lay para E-commerce', instructor: 'Sofía Reyes', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1f7ed4286-1774319801004.png", thumbnailAlt: 'Overhead flat lay arrangement of fashion accessories on white background for e-commerce', duration: '31:00', tier: 'apertura' as const, lessonCount: 10, rating: 4.7 },
{ id: 'pp-004', title: 'Fotografía de Botellas y Líquidos', instructor: 'Sofía Reyes', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1a124e3ab-1772147627773.png", thumbnailAlt: 'Professional bottle photography with backlit liquid creating translucent amber glow', duration: '55:20', tier: 'diafragma' as const, lessonCount: 20, rating: 4.9 },
{ id: 'pp-005', title: 'Props y Composición para Producto', instructor: 'Valentina Cruz', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_18c3fcab2-1772196420648.png", thumbnailAlt: 'Product photography composition with carefully arranged props and hero product', duration: '26:40', tier: 'obturador' as const, lessonCount: 8, rating: 4.6 }];


const bts = [
{ id: 'bts-001', title: 'BTS: Sesión Editorial para Vogue MX', instructor: 'Valentina Cruz', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_19b1925a8-1769680916668.png", thumbnailAlt: 'Behind the scenes of high-fashion editorial shoot with full crew and lighting team', duration: '1h 20min', tier: 'obturador' as const, lessonCount: 6, rating: 4.9 },
{ id: 'bts-002', title: 'BTS: Campaña de Perfume Luxury', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1aa57d80d-1772990049840.png", thumbnailAlt: 'Behind the scenes production of luxury perfume campaign with multiple light setups', duration: '58:00', tier: 'diafragma' as const, lessonCount: 5, rating: 4.8 },
{ id: 'bts-003', title: 'BTS: Retrato Corporativo para Banco', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_17c180661-1785194269837.png", thumbnailAlt: 'Behind the scenes of corporate portrait photography for banking client in office setting', duration: '44:30', tier: 'obturador' as const, lessonCount: 4, rating: 4.7 },
{ id: 'bts-004', title: 'BTS: Sesión Gastronómica para Restaurante', instructor: 'Sofía Reyes', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_10ea16ed2-1785194269832.png", thumbnailAlt: 'Behind the scenes of food photography session for upscale restaurant menu', duration: '36:15', tier: 'apertura' as const, lessonCount: 3, rating: 4.6 }];


const liveWorkshops = [
{ id: 'lw-001', title: 'Taller en Vivo: Iluminación Split', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1674e1494-1785194269867.png", thumbnailAlt: 'Live workshop thumbnail showing split lighting technique demonstration in studio', duration: '2h 00min', tier: 'diafragma' as const, isLive: true, isLocked: true, lessonCount: 1 },
{ id: 'lw-002', title: 'Masterclass: Edición de Moda', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1990f7adc-1778760199988.png", thumbnailAlt: 'Fashion photo editing masterclass live session with instructor screen sharing', duration: '1h 45min', tier: 'diafragma' as const, isLive: false, isLocked: true, lessonCount: 1 },
{ id: 'lw-003', title: 'Workshop: Portafolio y Marca Personal', instructor: 'Valentina Cruz', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_11ef698de-1768656193490.png", thumbnailAlt: 'Portfolio review workshop with instructor evaluating photography work on screen', duration: '1h 30min', tier: 'diafragma' as const, isLive: false, isLocked: true, lessonCount: 1 },
{ id: 'lw-004', title: 'Q&A: Equipamiento para Estudio', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_134d4276f-1773375271894.png", thumbnailAlt: 'Live Q&A session about studio equipment selection and budget recommendations', duration: '1h 00min', tier: 'diafragma' as const, isLive: true, isLocked: true, lessonCount: 1 }];


export default function DashboardCarousels() {
  return (
    <div className="flex flex-col gap-10 pt-10">
      <CourseCarousel title="Continuar Viendo" courses={continueWatching} />
      <CourseCarousel title="Iluminación de Estudio" courses={studioLighting} />
      <CourseCarousel title="Edición y Retoque Comercial" courses={editing} />
      <CourseCarousel title="Fotografía de Producto y Gastronómica" courses={productPhoto} />
      <CourseCarousel title="Detrás de Cámaras — BTS" courses={bts} />
      <CourseCarousel
        title="Talleres En Vivo"
        courses={liveWorkshops}
        badgeLabel="Solo Diafragma"
        badgeColor="tier-badge-diafragma" />
      
    </div>);

}