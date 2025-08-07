import { supabaseClient } from '../lib/supabase';

interface MedicalRecord {
  id: string;
  type: string;
  name: string;
  product_name?: string;
  application_date?: string;
  diagnosis_date?: string;
  next_due_date?: string;
  symptoms?: string;
  severity?: string;
  treatment?: string;
  veterinarian?: string;
  notes?: string;
  weight?: number;
  weight_unit?: string;
  date?: string;
  status?: string;
  created_at: string;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  age_display?: { value: number; unit: string };
  gender: string;
  weight: number;
  weight_display?: { value: number; unit: string };
  color?: string;
  is_neutered?: boolean;
  has_chip?: boolean;
  chip_number?: string;
  medical_notes?: string;
  created_at: string;
  photo_url?: string;
}

interface Owner {
  display_name: string;
  email: string;
  phone?: string;
}

const formatAge = (pet: Pet): string => {
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

const formatWeight = (pet: Pet): string => {
  if (pet.weight_display) {
    return `${pet.weight_display.value} ${pet.weight_display.unit}`;
  }
  return `${pet.weight} kg`;
};

const formatDate = (dateString: string): string => {
  if (!dateString) return 'No especificada';
  
  // If already in dd/mm/yyyy format, return as is
  if (dateString.includes('/')) {
    return dateString;
  }
  
  // If in ISO format, convert
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

const generateHTMLContent = (pet: Pet, owner: Owner, records: MedicalRecord[]): string => {
  // Group records by type
  const vaccines = records.filter(r => r.type === 'vaccine');
  const illnesses = records.filter(r => r.type === 'illness');
  const allergies = records.filter(r => r.type === 'allergy');
  const dewormings = records.filter(r => r.type === 'deworming');
  const weightRecords = records.filter(r => r.type === 'weight');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Historia Clínica - ${pet.name}</title>
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
                ${pet.photo_url ? `<img src="${pet.photo_url}" alt="${pet.name}" class="pet-image">` : ''}
                <div class="pet-info">
                    <h2>${pet.name}</h2>
                    <p><strong>${pet.breed}</strong></p>
                    <p>${pet.species === 'dog' ? 'Perro' : 'Gato'} • ${pet.gender === 'male' ? 'Macho' : 'Hembra'}</p>
                    ${pet.color ? `<p>Color: ${pet.color}</p>` : ''}
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
                            <div class="info-value">${pet.name}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Especie:</div>
                            <div class="info-value">${pet.species === 'dog' ? 'Perro' : 'Gato'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Raza:</div>
                            <div class="info-value">${pet.breed}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Sexo:</div>
                            <div class="info-value">${pet.gender === 'male' ? 'Macho' : 'Hembra'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Edad:</div>
                            <div class="info-value">${formatAge(pet)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Peso:</div>
                            <div class="info-value">${formatWeight(pet)}</div>
                        </div>
                        ${pet.color ? `
                        <div class="info-item">
                            <div class="info-label">Color:</div>
                            <div class="info-value">${pet.color}</div>
                        </div>
                        ` : ''}
                        <div class="info-item">
                            <div class="info-label">Estado reproductivo:</div>
                            <div class="info-value">${pet.is_neutered ? 'Castrado/Esterilizado' : 'Entero'}</div>
                        </div>
                        ${pet.has_chip ? `
                        <div class="info-item">
                            <div class="info-label">Microchip:</div>
                            <div class="info-value">${pet.chip_number || 'Sí'}</div>
                        </div>
                        ` : ''}
                        <div class="info-item">
                            <div class="info-label">Fecha de registro:</div>
                            <div class="info-value">${formatDate(pet.created_at)}</div>
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
                            <div class="info-value">${owner.display_name}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Email:</div>
                            <div class="info-value">${owner.email}</div>
                        </div>
                        ${owner.phone ? `
                        <div class="info-item">
                            <div class="info-label">Teléfono:</div>
                            <div class="info-value">${owner.phone}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            ${pet.medical_notes ? `
            <div class="section">
                <div class="section-title">
                    📝 NOTAS MÉDICAS GENERALES
                </div>
                <div class="section-content">
                    <div class="record-item">
                        <div>${pet.medical_notes}</div>
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
                            <strong>Fecha de aplicación:</strong> ${formatDate(vaccine.application_date || '')}
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
                            ${illness.status === 'active' ? '<span class="badge badge-danger">Activa</span>' : 
                              illness.status === 'recovered' ? '<span class="badge badge-success">Recuperada</span>' : ''}
                        </div>
                        <div class="record-detail">
                            <strong>Fecha de diagnóstico:</strong> ${formatDate(illness.diagnosis_date || '')}
                        </div>
                        ${illness.treatment ? `
                        <div class="record-detail">
                            <strong>Tratamiento:</strong> ${illness.treatment}
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
                            ${allergy.severity.toLowerCase().includes('severa') ? '<span class="badge badge-danger">Alta</span>' : 
                              allergy.severity.toLowerCase().includes('moderada') ? '<span class="badge badge-warning">Media</span>' : 
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
                            <strong>Fecha de aplicación:</strong> ${formatDate(deworming.application_date || '')}
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
                <p>Mascota: ${pet.name} | Propietario: ${owner.display_name}</p>
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
};

// Export the main function
export const generateMedicalHistoryHTML = async (petId: string, ownerId: string): Promise<string> => {
  try {
    // Check session validity before starting
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Sesión no válida. Por favor inicia sesión nuevamente.');
    }

    // Fetch pet data
    const { data: petData, error: petError } = await supabaseClient
      .from('pets')
      .select('*')
      .eq('id', petId)
      .single();

    if (petError || !petData) {
      console.error('Error fetching pet data:', petError);
      if (petError?.message?.includes('JWT') || petError?.message?.includes('expired')) {
        throw new Error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      }
      throw new Error('No se pudo obtener la información de la mascota');
    }

    // Fetch owner data
    const { data: ownerData, error: ownerError } = await supabaseClient
      .from('profiles')
      .select('display_name, email, phone')
      .eq('id', ownerId)
      .single();

    if (ownerError || !ownerData) {
      console.error('Error fetching owner data:', ownerError);
      if (ownerError?.message?.includes('JWT') || ownerError?.message?.includes('expired')) {
        throw new Error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      }
      throw new Error('No se pudo obtener la información del propietario');
    }

    // Fetch medical records
    const { data: medicalRecords, error: recordsError } = await supabaseClient
      .from('pet_health')
      .select('*')
      .eq('pet_id', petId)
      .order('created_at', { ascending: false });

    if (recordsError) {
      console.error('Error fetching medical records:', recordsError);
      if (recordsError?.message?.includes('JWT') || recordsError?.message?.includes('expired')) {
        throw new Error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      }
      throw new Error('No se pudieron obtener los registros médicos');
    }

    const pet = petData as Pet;
    const owner = ownerData as Owner;
    const records = (medicalRecords || []) as MedicalRecord[];

    // Generate HTML content
    const htmlContent = generateHTMLContent(pet, owner, records);

    return htmlContent;
  } catch (error) {
    throw error;
  }
};

// Export additional utility functions
export { formatAge, formatWeight, formatDate, generateHTMLContent };