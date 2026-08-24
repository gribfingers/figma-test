export interface Airport {
  code: string;
  name: string;
  city: string;
}

export const AIRPORTS: Airport[] = [
  { code: "SVO", name: "Sheremetyevo", city: "Moscow" },
  { code: "DME", name: "Domodedovo", city: "Moscow" },
  { code: "VKO", name: "Vnukovo", city: "Moscow" },
  { code: "LED", name: "Pulkovo", city: "Saint Petersburg" },
  { code: "SVX", name: "Koltsovo", city: "Yekaterinburg" },
];
