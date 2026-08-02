export interface WeightRange {
  min: number;
  max: number;
  unit: string;
}

export interface WeightRecordLike {
  weight?: number | string | null;
  weight_unit?: string | null;
  created_at?: string | null;
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

export const getPetAgeInMonths = (pet: any): number | undefined => {
  if (!pet) return undefined;

  if (pet.birth_date) {
    const birthDate = new Date(pet.birth_date);
    if (!Number.isNaN(birthDate.getTime())) {
      const today = new Date();
      const monthsDiff =
        (today.getFullYear() - birthDate.getFullYear()) * 12 +
        (today.getMonth() - birthDate.getMonth());

      return Math.max(0, monthsDiff);
    }
  }

  const ageDisplay = pet.age_display || pet.ageDisplay;
  if (ageDisplay && typeof ageDisplay === 'object') {
    const value = toNumber(ageDisplay.value);
    const unit = String(ageDisplay.unit || '').toLowerCase();

    if (value === undefined) return undefined;
    if (unit.includes('day')) return Math.max(0, Math.round(value / 30));
    if (unit.includes('month')) return Math.max(0, Math.round(value));

    return Math.max(0, Math.round(value * 12));
  }

  const age = toNumber(pet.age);
  if (age === undefined || age <= 0) {
    return undefined;
  }

  return Math.round(age * 12);
};

export const getPetAgeInYears = (pet: any): number | undefined => {
  const ageInMonths = getPetAgeInMonths(pet);
  if (ageInMonths === undefined) return undefined;
  return Math.round((ageInMonths / 12) * 10) / 10;
};

export const formatPetAgeLabel = (pet: any): string => {
  const ageInMonths = getPetAgeInMonths(pet);

  if (ageInMonths === undefined) {
    return pet?.age ? `${pet.age} año${pet.age === 1 ? '' : 's'}` : 'Edad no disponible';
  }

  if (ageInMonths < 12) {
    return `${ageInMonths} mes${ageInMonths === 1 ? '' : 'es'}`;
  }

  const years = Math.floor(ageInMonths / 12);
  const remainingMonths = ageInMonths % 12;

  if (remainingMonths === 0) {
    return `${years} año${years === 1 ? '' : 's'}`;
  }

  return `${years} año${years === 1 ? '' : 's'} y ${remainingMonths} mes${remainingMonths === 1 ? '' : 'es'}`;
};

export const getLatestWeightRecord = (weightRecords: WeightRecordLike[] = []) => {
  if (!weightRecords.length) return null;

  return [...weightRecords].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  })[weightRecords.length - 1];
};

export const getWeightRange = (pet: any): WeightRange | null => {
  const breedInfo = pet?.breed_info || pet?.breedInfo;
  if (!breedInfo || !pet?.gender) return null;

  const gender = String(pet.gender).toLowerCase();
  const isMale = gender === 'male' || gender === 'macho';

  const minCandidate =
    breedInfo[isMale ? 'min_weight_male' : 'min_weight_female'] ??
    breedInfo.min_weight ??
    breedInfo.minWeight;
  const maxCandidate =
    breedInfo[isMale ? 'max_weight_male' : 'max_weight_female'] ??
    breedInfo.max_weight ??
    breedInfo.maxWeight;

  const minWeight = toNumber(minCandidate);
  const maxWeight = toNumber(maxCandidate);
  if (minWeight === undefined || maxWeight === undefined) return null;

  const unit = String(pet.weight_display?.unit || pet.weightDisplay?.unit || 'kg').toLowerCase();

  if (unit === 'lb' || unit === 'lbs') {
    return {
      min: Math.round(minWeight * 2.20462 * 10) / 10,
      max: Math.round(maxWeight * 2.20462 * 10) / 10,
      unit: 'lb',
    };
  }

  return {
    min: Math.round(minWeight * 10) / 10,
    max: Math.round(maxWeight * 10) / 10,
    unit: 'kg',
  };
};

export const getWeightStatus = (
  currentWeight: number | undefined,
  idealRange: WeightRange | null,
): {
  status: 'underweight' | 'ideal' | 'overweight' | 'unknown';
  difference?: number;
} => {
  if (currentWeight === undefined || !idealRange) {
    return { status: 'unknown' };
  }

  if (currentWeight < idealRange.min) {
    return {
      status: 'underweight',
      difference: Math.round((idealRange.min - currentWeight) * 10) / 10,
    };
  }

  if (currentWeight > idealRange.max) {
    return {
      status: 'overweight',
      difference: Math.round((currentWeight - idealRange.max) * 10) / 10,
    };
  }

  return { status: 'ideal' };
};

export const formatWeightLabel = (weight: number | string | undefined, unit: string = 'kg'): string => {
  const numericWeight = toNumber(weight);
  if (numericWeight === undefined) return 'Peso no disponible';
  return `${numericWeight} ${unit}`;
};
