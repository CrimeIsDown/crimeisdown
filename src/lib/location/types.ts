export type Coordinate = {
  lat: number;
  lng: number;
};

export type StreamInfo = {
  name: string;
  description: string;
  frequency?: string;
  slug: string;
  openmhz?: string | null;
  broadcastify?: string | null;
};

export type MetaContext = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  inChicago: boolean;
  neighborhood?: string;
  communityArea?: string;
  ward?: string;
  alderman?: {
    ward: string;
    name: string;
    website?: string;
  };
};

export type PoliceContext = {
  district?: string;
  beat?: string;
  area?: string;
  zone?: StreamInfo & { num: string };
};

export type FireStation = {
  name?: string;
  engine: string;
  truck: string;
  ambo: string;
  squad: string;
  special: string;
  batt: string;
  fireDist: string;
  emsDist: string;
  addr: string;
  city: string;
  state: string;
  zip: string | number;
  latitude: number;
  longitude: number;
  radio: string;
  distance?: number;
  distanceMi?: number;
};

export type FireContext = {
  battalion?: string;
  channel?: string;
  emsDistrict?: string;
  fireDistrict?: string;
  nearestEngine?: FireStation;
  nearestTruck?: FireStation;
  nearestSquad?: FireStation;
  nearestAmbo?: FireStation;
};

export type TraumaCenter = {
  name: string;
  medChannel: string;
  level1Adult: boolean;
  level1Ped: boolean;
  addr: string;
  city: string;
  state: string;
  zip: string | number;
  latitude: number;
  longitude: number;
  distance?: number;
  distanceMi?: number;
};

export type EmsContext = {
  nearestTraumaAdult?: TraumaCenter;
  nearestTraumaPed?: TraumaCenter;
};

export type LocationContextResult = {
  query: {
    q?: string;
    lat?: number;
    lng?: number;
  };
  meta: MetaContext;
  police?: PoliceContext;
  fire?: FireContext;
  ems?: EmsContext;
};

export type LookupRequest = {
  origin: string;
  q?: string;
  lat?: number;
  lng?: number;
};
