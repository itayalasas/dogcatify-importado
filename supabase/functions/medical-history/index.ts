import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const petId = url.pathname.split('/').pop();
    const token = url.searchParams.get('token');
    
    if (!petId) {
      return new Response('Pet ID is required', {
        status: 400,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders },
      });
    }

    console.log('Medical history request:', { petId, hasToken: !!token });

    // Initialize Supabase client with service role for unrestricted access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response('Server configuration error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storage: undefined
      }
    });

    // If token is provided, verify it first
    if (token) {
      console.log('Verifying access token...');
      
      const { data: tokenData, error: tokenError } = await supabase
        .from('medical_history_tokens')
        .select('*')
        .eq('token', token)
        .single();

      console.log('Token verification result:', { 
        found: !!tokenData, 
        error: tokenError?.message,
        petId: tokenData?.pet_id,
        expiresAt: tokenData?.expires_at
      });

      if (tokenError || !tokenData) {
        console.error('Invalid token:', tokenError);
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head><title>Enlace Inválido</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🚫 Enlace Inválido</h1>
            <p>El enlace proporcionado no es válido o ha sido revocado.</p>
            <p>Solicita un nuevo enlace al propietario de la mascota.</p>
          </body>
          </html>
        `, {
          status: 400,
          headers: { 'Content-Type': 'text/html', ...corsHeaders },
        });
      }

      // Check if token has expired
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      
      if (now > expiresAt) {
        console.log('Token expired');
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Enlace Expirado</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f9fafb; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .icon { font-size: 64px; margin-bottom: 20px; }
              h1 { color: #ef4444; margin-bottom: 16px; }
              p { color: #6b7280; line-height: 1.6; margin-bottom: 12px; }
              .highlight { background-color: #fef3c7; padding: 12px; border-radius: 8px; margin: 20px 0; }
            </style>
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <div class="container">
              <div class="icon">🕒</div>
              <h1>Enlace Expirado</h1>
              <p>Este enlace ha expirado por seguridad (válido por 2 horas).</p>
              <div class="highlight">
                <p><strong>Para acceder nuevamente:</strong></p>
                <p>• Solicita al propietario que genere un nuevo enlace</p>
                <p>• El propietario puede crear un nuevo QR desde la app</p>
                <p>• Los nuevos enlaces son válidos por 2 horas</p>
              </div>
              <p><small>Los enlaces expiran automáticamente para proteger la información médica.</small></p>
            </div>
          </body>
          </html>
        `, {
          status: 410,
          headers: { 'Content-Type': 'text/html', ...corsHeaders },
        });
      }

      // Update access tracking
      try {
        await supabase
          .from('medical_history_tokens')
          .update({
            accessed_at: new Date().toISOString(),
            access_count: (tokenData.access_count || 0) + 1
          })
          .eq('id', tokenData.id);
        
        console.log('Token access tracked:', {
          accessCount: (tokenData.access_count || 0) + 1,
          petId: tokenData.pet_id
        });
      } catch (trackingError) {
        console.warn('Could not update access tracking:', trackingError);
      }

      // Verify token matches the requested pet
      if (tokenData.pet_id !== petId) {
        console.error('Token pet ID mismatch');
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head><title>Acceso Denegado</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🚫 Acceso Denegado</h1>
            <p>Este enlace no corresponde a la mascota solicitada.</p>
            <p>Verifica que el enlace sea correcto.</p>
          </body>
          </html>
        `, {
          status: 403,
          headers: { 'Content-Type': 'text/html', ...corsHeaders },
        });
      }
      
      console.log('Token verified successfully for pet:', tokenData.pet_id);
    }

    console.log('Fetching medical history for pet:', petId);

    // Fetch pet data
    console.log('Fetching pet data with service role...');
    const { data: petData, error: petError } = await supabase
      .from('pets')
      .select('*')
      .eq('id', petId)
      .single();

    console.log('Pet data result:', { 
      found: !!petData, 
      error: petError?.message,
      petName: petData?.name,
      ownerId: petData?.owner_id
    });

    if (petError || !petData) {
      console.error('Pet not found:', petError);
      return new Response('Pet not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders },
      });
    }

    // Fetch owner data
    console.log('Fetching owner data for owner_id:', petData.owner_id);
    const { data: ownerData, error: ownerError } = await supabase
      .from('profiles')
      .select('display_name, email, phone')
      .eq('id', petData.owner_id)
      .single();

    console.log('Owner data result:', { 
      found: !!ownerData, 
      error: ownerError?.message,
      ownerName: ownerData?.display_name,
      ownerEmail: ownerData?.email
    });

    if (ownerError || !ownerData) {
      console.error('Owner not found:', ownerError);
      return new Response('Owner not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders },
      });
    }

    // Fetch medical records
    console.log('Fetching medical records for pet_id:', petId);
    const { data: medicalRecords, error: recordsError } = await supabase
      .from('pet_health')
      .select('*')
      .eq('pet_id', petId)
      .order('created_at', { ascending: false });

    console.log('Medical records result:', { 
      count: medicalRecords?.length || 0, 
      error: recordsError?.message,
      recordTypes: medicalRecords?.map(r => r.type) || [],
      sampleRecord: medicalRecords?.[0] || null
    });

    if (recordsError) {
      console.error('Error fetching medical records:', recordsError);
    } else {
      console.log('Medical records fetched successfully:', {
        totalRecords: medicalRecords?.length || 0,
        recordsByType: {
          vaccines: medicalRecords?.filter(r => r.type === 'vaccine').length || 0,
          illnesses: medicalRecords?.filter(r => r.type === 'illness').length || 0,
          allergies: medicalRecords?.filter(r => r.type === 'allergy').length || 0,
          dewormings: medicalRecords?.filter(r => r.type === 'deworming').length || 0,
          weight: medicalRecords?.filter(r => r.type === 'weight').length || 0
        }
      });
    }

    const records = medicalRecords || [];

    console.log('Generating HTML for pet:', petData.name);

    // Helper functions
    const formatAge = (pet: any): string => {
      if (pet.age_display) {
        const { value, unit } = pet.age_display;
        switch (unit) {
          case 'days': return `${value} ${value === 1 ? 'día' : 'días'}`;
          case 'months': return `${value} ${value === 1 ? 'mes' : 'meses'}`;
          case 'years': return `${value} ${value === 1 ? 'año' : 'años'}`;
          default: return `${value} ${unit}`;
        }
      }
      return `${pet.age} ${pet.age === 1 ? 'año' : 'años'}`;
    };

    const formatWeight = (pet: any): string => {
      if (pet.weight_display) {
        return `${pet.weight_display.value} ${pet.weight_display.unit}`;
      }
      return `${pet.weight} kg`;
    };

    const formatDate = (dateString: string): string => {
      if (!dateString) return 'No especificada';
      
      if (dateString.includes('/')) {
        return dateString;
      }
      
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch {
        return dateString;
      }
    };

    // Helper function for status badges
    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'active':
          return 'Activa';
        case 'recovered':
          return 'Recuperada';
        case 'chronic':
          return 'Crónica';
        default:
          return status;
      }
    };

    // Helper function for severity badges
    const getSeverityBadge = (severity: string) => {
      const severityLower = severity.toLowerCase();
      if (severityLower.includes('severa') || severityLower.includes('alta')) {
        return 'Alta';
      } else if (severityLower.includes('moderada') || severityLower.includes('media')) {
        return 'Media';
      } else if (severityLower.includes('leve') || severityLower.includes('baja')) {
        return 'Baja';
      }
      return severity;
    };

    // Group records by type
    const vaccines = records.filter(r => r.type === 'vaccine');
    const illnesses = records.filter(r => r.type === 'illness');
    const allergies = records.filter(r => r.type === 'allergy');
    const dewormings = records.filter(r => r.type === 'deworming');
    const weightRecords = records.filter(r => r.type === 'weight');

    console.log('Records grouped by type:', {
      vaccines: vaccines.length,
      illnesses: illnesses.length,
      allergies: allergies.length,
      dewormings: dewormings.length,
      weightRecords: weightRecords.length,
      totalRecords: records.length,
      sampleVaccine: vaccines[0] || null,
      sampleIllness: illnesses[0] || null,
      sampleAllergy: allergies[0] || null,
      sampleDeworming: dewormings[0] || null,
      sampleWeight: weightRecords[0] || null
    });


    // Generate HTML content
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Historia Clínica - ${petData.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            min-height: 100vh;
        }
        .header {
            background: linear-gradient(135deg, #2D6A6F 0%, #1e4a4f 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 700;
        }
        .header p {
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .pet-profile {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            border: 1px solid #dee2e6;
        }
        .pet-image {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            object-fit: cover;
            margin-right: 20px;
            border: 4px solid #2D6A6F;
        }
        .pet-info h2 {
            font-size: 24px;
            color: #2D6A6F;
            margin-bottom: 5px;
        }
        .pet-info p {
            color: #6c757d;
            margin-bottom: 3px;
        }
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .section-title {
            background: linear-gradient(135deg, #2D6A6F 0%, #1e4a4f 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px 10px 0 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-content {
            background-color: white;
            border: 1px solid #dee2e6;
            border-top: none;
            border-radius: 0 0 10px 10px;
            padding: 20px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .info-item {
            padding: 15px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 8px;
            border: 1px solid #dee2e6;
        }
        .info-label {
            font-weight: 600;
            color: #2D6A6F;
            margin-bottom: 5px;
            font-size: 14px;
        }
        .info-value {
            color: #495057;
            font-size: 16px;
        }
        .record-item {
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border: 1px solid #dee2e6;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }
        .record-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .record-title {
            font-weight: 600;
            font-size: 16px;
            color: #2D6A6F;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .record-detail {
            margin-bottom: 8px;
            font-size: 14px;
            color: #495057;
        }
        .record-detail strong {
            color: #2D6A6F;
        }
        .weight-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
        }
        .weight-item {
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            padding: 15px;
            border-radius: 10px;
            text-align: center;
            border: 1px solid #90caf9;
        }
        .weight-date {
            font-weight: 600;
            color: #1565c0;
            margin-bottom: 5px;
        }
        .weight-value {
            font-size: 18px;
            font-weight: 700;
            color: #0d47a1;
        }
        .weight-notes {
            font-size: 12px;
            color: #1976d2;
            margin-top: 5px;
            font-style: italic;
        }
        .footer {
            margin-top: 40px;
            padding: 20px;
            background-color: #f8f9fa;
            border-top: 3px solid #2D6A6F;
            text-align: center;
            border-radius: 10px;
        }
        .footer p {
            font-size: 12px;
            color: #6c757d;
            margin-bottom: 5px;
        }
        .empty-section {
            text-align: center;
            padding: 30px;
            color: #6c757d;
            font-style: italic;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            margin-left: 10px;
        }
        .badge-success {
            background-color: #d4edda;
            color: #155724;
        }
        .badge-warning {
            background-color: #fff3cd;
            color: #856404;
        }
        .badge-danger {
            background-color: #f8d7da;
            color: #721c24;
        }
        @media print {
            body { 
                margin: 0; 
                background-color: white;
            }
            .container {
                box-shadow: none;
                max-width: none;
            }
            .section { 
                page-break-inside: avoid; 
            }
            .record-item:hover {
                transform: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
        }
        @media (max-width: 768px) {
            .content {
                padding: 20px;
            }
            .pet-profile {
                flex-direction: column;
                text-align: center;
            }
            .pet-image {
                margin-right: 0;
                margin-bottom: 15px;
            }
            .info-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐾 HISTORIA CLÍNICA VETERINARIA</h1>
            <p>Generada el ${new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</p>
        </div>

        <div class="content">
            <div class="pet-profile">
                ${petData.photo_url ? `<img src="${petData.photo_url}" alt="${petData.name}" class="pet-image">` : ''}
                <div class="pet-info">
                    <h2>${petData.name}</h2>
                    <p><strong>${petData.breed}</strong></p>
                    <p>${petData.species === 'dog' ? 'Perro' : 'Gato'} • ${petData.gender === 'male' ? 'Macho' : 'Hembra'}</p>
                    ${petData.color ? `<p>Color: ${petData.color}</p>` : ''}
                </div>
            </div>

            <div class="section">
                <div class="section-title">
                    📋 INFORMACIÓN DE LA MASCOTA
                </div>
                <div class="section-content">
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Nombre:</div>
                            <div class="info-value">${petData.name}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Especie:</div>
                            <div class="info-value">${petData.species === 'dog' ? 'Perro' : 'Gato'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Raza:</div>
                            <div class="info-value">${petData.breed}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Sexo:</div>
                            <div class="info-value">${petData.gender === 'male' ? 'Macho' : 'Hembra'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Edad:</div>
                            <div class="info-value">${formatAge(petData)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Peso:</div>
                            <div class="info-value">${formatWeight(petData)}</div>
                        </div>
                        ${petData.color ? `
                        <div class="info-item">
                            <div class="info-label">Color:</div>
                            <div class="info-value">${petData.color}</div>
                        </div>
                        ` : ''}
                        <div class="info-item">
                            <div class="info-label">Estado reproductivo:</div>
                            <div class="info-value">${petData.is_neutered ? 'Castrado/Esterilizado' : 'Entero'}</div>
                        </div>
                        ${petData.has_chip ? `
                        <div class="info-item">
                            <div class="info-label">Microchip:</div>
                            <div class="info-value">${petData.chip_number || 'Sí'}</div>
                        </div>
                        ` : ''}
                        <div class="info-item">
                            <div class="info-label">Fecha de registro:</div>
                            <div class="info-value">${formatDate(petData.created_at)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">
                    👤 INFORMACIÓN DEL PROPIETARIO
                </div>
                <div class="section-content">
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Nombre:</div>
                            <div class="info-value">${ownerData.display_name}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Email:</div>
                            <div class="info-value">${ownerData.email}</div>
                        </div>
                        ${ownerData.phone ? `
                        <div class="info-item">
                            <div class="info-label">Teléfono:</div>
                            <div class="info-value">${ownerData.phone}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            ${petData.medical_notes ? `
            <div class="section">
                <div class="section-title">
                    📝 NOTAS MÉDICAS GENERALES
                </div>
                <div class="section-content">
                    <div class="record-item">
                        <div>${petData.medical_notes}</div>
                    </div>
                </div>
            </div>
            ` : ''}

            <div class="section">
                <div class="section-title">
                    💉 HISTORIAL DE VACUNACIÓN
                </div>
                <div class="section-content">
                    ${vaccines.length > 0 ? vaccines.map((vaccine, index) => `
                    <div class="record-item">
                        <div class="record-title">
                            💉 ${index + 1}. ${vaccine.name}
                        </div>
                        <div class="record-detail">
                            <strong>Fecha de aplicación:</strong> ${formatDate(vaccine.application_date || vaccine.date || '')}
                        </div>
                        ${vaccine.next_due_date ? `
                        <div class="record-detail">
                            <strong>Próxima dosis:</strong> ${formatDate(vaccine.next_due_date)}
                            <span class="badge badge-warning">Pendiente</span>
                        </div>
                        ` : ''}
                        ${vaccine.veterinarian ? `
                        <div class="record-detail">
                            <strong>Veterinario:</strong> ${vaccine.veterinarian}
                        </div>
                        ` : ''}
                        ${vaccine.notes ? `
                        <div class="record-detail">
                            <strong>Notas:</strong> ${vaccine.notes}
                        </div>
                        ` : ''}
                    </div>
                    `).join('') : `
                    <div class="empty-section">
                        <p>No hay vacunas registradas</p>
                    </div>
                    `}
                </div>
            </div>

            <div class="section">
                <div class="section-title">
                    🏥 HISTORIAL DE ENFERMEDADES
                </div>
                <div class="section-content">
                    ${illnesses.length > 0 ? illnesses.map((illness, index) => `
                    <div class="record-item">
                        <div class="record-title">
                            🏥 ${index + 1}. ${illness.name}
                            ${illness.status ? `<span class="badge ${illness.status === 'active' ? 'badge-danger' : illness.status === 'recovered' ? 'badge-success' : 'badge-warning'}">${getStatusBadge(illness.status)}</span>` : ''}
                        </div>
                        <div class="record-detail">
                            <strong>Fecha de diagnóstico:</strong> ${formatDate(illness.diagnosis_date || illness.date || '')}
                        </div>
                        ${illness.treatment ? `
                        <div class="record-detail">
                            <strong>Tratamiento:</strong> ${illness.treatment}
                        </div>
                        ` : ''}
                        ${illness.symptoms ? `
                        <div class="record-detail">
                            <strong>Síntomas:</strong> ${illness.symptoms}
                        </div>
                        ` : ''}
                        ${illness.severity ? `
                        <div class="record-detail">
                            <strong>Severidad:</strong> ${illness.severity}
                        </div>
                        ` : ''}
                        ${illness.veterinarian ? `
                        <div class="record-detail">
                            <strong>Veterinario:</strong> ${illness.veterinarian}
                        </div>
                        ` : ''}
                        ${illness.notes ? `
                        <div class="record-detail">
                            <strong>Notas:</strong> ${illness.notes}
                        </div>
                        ` : ''}
                    </div>
                    `).join('') : `
                    <div class="empty-section">
                        <p>No hay enfermedades registradas</p>
                    </div>
                    `}
                </div>
            </div>

            <div class="section">
                <div class="section-title">
                    🚨 ALERGIAS CONOCIDAS
                </div>
                <div class="section-content">
                    ${allergies.length > 0 ? allergies.map((allergy, index) => `
                    <div class="record-item">
                        <div class="record-title">
                            🚨 ${index + 1}. ${allergy.name}
                        </div>
                        ${allergy.symptoms ? `
                        <div class="record-detail">
                            <strong>Síntomas:</strong> ${allergy.symptoms}
                        </div>
                        ` : ''}
                        ${allergy.severity ? `
                        <div class="record-detail">
                            <strong>Severidad:</strong> ${allergy.severity}
                            ${allergy.severity.toLowerCase().includes('severa') || allergy.severity.toLowerCase().includes('alta') ? 
                              '<span class="badge badge-danger">Alta</span>' : 
                              allergy.severity.toLowerCase().includes('moderada') || allergy.severity.toLowerCase().includes('media') ? 
                              '<span class="badge badge-warning">Media</span>' : 
                              '<span class="badge badge-success">Baja</span>'}
                        </div>
                        ` : ''}
                        ${allergy.treatment ? `
                        <div class="record-detail">
                            <strong>Tratamiento:</strong> ${allergy.treatment}
                        </div>
                        ` : ''}
                        ${allergy.notes ? `
                        <div class="record-detail">
                            <strong>Notas:</strong> ${allergy.notes}
                        </div>
                        ` : ''}
                    </div>
                    `).join('') : `
                    <div class="empty-section">
                        <p>No hay alergias registradas</p>
                    </div>
                    `}
                </div>
            </div>

            <div class="section">
                <div class="section-title">
                    💊 HISTORIAL DE DESPARASITACIÓN
                </div>
                <div class="section-content">
                    ${dewormings.length > 0 ? dewormings.map((deworming, index) => `
                    <div class="record-item">
                        <div class="record-title">
                            💊 ${index + 1}. ${deworming.product_name || deworming.name}
                        </div>
                        <div class="record-detail">
                            <strong>Fecha de aplicación:</strong> ${formatDate(deworming.application_date || deworming.date || '')}
                        </div>
                        ${deworming.next_due_date ? `
                        <div class="record-detail">
                            <strong>Próxima dosis:</strong> ${formatDate(deworming.next_due_date)}
                            <span class="badge badge-warning">Pendiente</span>
                        </div>
                        ` : ''}
                        ${deworming.veterinarian ? `
                        <div class="record-detail">
                            <strong>Veterinario:</strong> ${deworming.veterinarian}
                        </div>
                        ` : ''}
                        ${deworming.notes ? `
                        <div class="record-detail">
                            <strong>Notas:</strong> ${deworming.notes}
                        </div>
                        ` : ''}
                    </div>
                    `).join('') : `
                    <div class="empty-section">
                        <p>No hay desparasitaciones registradas</p>
                    </div>
                    `}
                </div>
            </div>

            <div class="section">
                <div class="section-title">
                    ⚖️ HISTORIAL DE PESO
                </div>
                <div class="section-content">
                    ${weightRecords.length > 0 ? `
                    <div class="weight-grid">
                        ${weightRecords.slice(0, 12).map(weight => `
                        <div class="weight-item">
                            <div class="weight-date">${formatDate(weight.date || '')}</div>
                            <div class="weight-value">${weight.weight} ${weight.weight_unit || 'kg'}</div>
                            ${weight.notes && weight.notes !== 'Peso inicial al registrar la mascota' ? `
                            <div class="weight-notes">${weight.notes}</div>
                            ` : ''}
                        </div>
                        `).join('')}
                    </div>
                    ${weightRecords.length > 12 ? `
                    <div style="text-align: center; margin-top: 20px; color: #6c757d; font-style: italic;">
                        ... y ${weightRecords.length - 12} registros más
                    </div>
                    ` : ''}
                    ` : `
                    <div class="empty-section">
                        <p>No hay registros de peso</p>
                    </div>
                    `}
                </div>
            </div>

            <div class="footer">
                <p><strong>Historia clínica generada por DogCatiFy</strong></p>
                <p>Fecha de generación: ${new Date().toLocaleDateString('es-ES')}</p>
                <p>Mascota: ${petData.name} | Propietario: ${ownerData.display_name}</p>
                <p>Para uso veterinario exclusivamente</p>
                <p style="margin-top: 10px; font-size: 10px;">
                    Esta historia clínica contiene información médica confidencial y debe ser tratada con la debida confidencialidad médica.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    console.log('HTML content generated successfully, length:', htmlContent.length);

    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Error in medical-history function:', error);
    return new Response(
      `Error generating medical history: ${error.message}`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders },
      }
    );
  }
});