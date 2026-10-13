// D-21: sample data for the F0 prototype only. Deleted together with src/prototype and
// src/app/(prototype) before F2 (rule 05 #8). Gantt cells are hand-written here because the
// real cell data comes from progress-ews (F4/F5); the prototype must not compute it.
import type { EwsLevel, ProjectStatus } from "@/shared/project-status";

export type SampleProject = {
  code: string;
  name: string;
  category: string;
  companyCode: string;
  mainEstate: string;
  extraEstates: number;
  wilayah: string;
  region: string;
  status: ProjectStatus;
  progress: string;
  ews: { level: EwsLevel; deviation: string };
  pic: string;
  targetEnd: string;
  budget: string;
  budgetOfficial: boolean;
};

export const SAMPLE_PROJECTS: readonly SampleProject[] = [
  {
    code: "WM-THIP-2026-0001",
    name: "Normalisasi kanal blok A",
    category: "Normalisasi Sungai",
    companyCode: "THIP",
    mainEstate: "Meranti",
    extraEstates: 1,
    wilayah: "THIP 1",
    region: "Region 1",
    status: "PROCUREMENT",
    progress: "42.5",
    ews: { level: "YELLOW", deviation: "6.2" },
    pic: "PIC Region 1",
    targetEnd: "2026-12-19",
    budget: "1250000000",
    budgetOfficial: true,
  },
  {
    code: "WM-THIP-2026-0002",
    name: "Tanggul pengaman divisi 3",
    category: "Tanggul",
    companyCode: "THIP",
    mainEstate: "Ramin",
    extraEstates: 0,
    wilayah: "THIP 1",
    region: "Region 1",
    status: "EXECUTION",
    progress: "71.0",
    ews: { level: "GREEN", deviation: "2.1" },
    pic: "PIC Region 1",
    targetEnd: "2026-11-28",
    budget: "640000000",
    budgetOfficial: true,
  },
  {
    code: "WM-THIP-2026-0003",
    name: "Pintu air outlet kanal utama",
    category: "Bangunan Air (pintu air, gorong-gorong, spillway)",
    companyCode: "THIP",
    mainEstate: "Meranti",
    extraEstates: 0,
    wilayah: "THIP 1",
    region: "Region 1",
    status: "EXECUTION",
    progress: "18.4",
    ews: { level: "RED", deviation: "12.3" },
    pic: "PIC Region 1",
    targetEnd: "2026-11-14",
    budget: "385500000",
    budgetOfficial: true,
  },
  {
    code: "WM-THIP-2026-0004",
    name: "Desilting parit kolektor",
    category: "Desilting",
    companyCode: "THIP",
    mainEstate: "Ramin",
    extraEstates: 0,
    wilayah: "THIP 1",
    region: "Region 1",
    status: "WAITING_AFCE_AR",
    progress: "0",
    ews: { level: "GREEN", deviation: "0" },
    pic: "PIC Region 1",
    targetEnd: "2027-02-27",
    budget: "210000000",
    budgetOfficial: false,
  },
  {
    code: "WM-THIP-2026-0005",
    name: "Parit baru blok C",
    category: "Pembuatan Parit/Kanal Baru",
    companyCode: "THIP",
    mainEstate: "Meranti",
    extraEstates: 0,
    wilayah: "THIP 1",
    region: "Region 1",
    status: "ON_HOLD",
    progress: "35.0",
    ews: { level: "YELLOW", deviation: "7.8" },
    pic: "PIC Region 1",
    targetEnd: "2027-01-16",
    budget: "920000000",
    budgetOfficial: true,
  },
  {
    code: "WM-THIP-2026-0006",
    name: "Survei jaringan drainase timur",
    category: "Lainnya",
    companyCode: "THIP",
    mainEstate: "Ramin",
    extraEstates: 0,
    wilayah: "THIP 1",
    region: "Region 1",
    status: "SURVEY",
    progress: "0",
    ews: { level: "GREEN", deviation: "0" },
    pic: "PIC Region 1",
    targetEnd: "2027-03-27",
    budget: "150000000",
    budgetOfficial: false,
  },
];

// Hand-written: real KPIs come from progress-ews (F4/F5).
export const SAMPLE_KPI = {
  activeProjects: 6,
  ewsRed: 1,
  ewsYellow: 2,
  weightedProgress: "27.8",
};

export function findSampleProject(code: string): SampleProject | undefined {
  return SAMPLE_PROJECTS.find((project) => project.code === code);
}

export type GanttCellKind = "none" | "base" | "rev1" | "rev2";
export type GanttSymbol = "#" | "✓" | null;

export type GanttRow = {
  id: string;
  depth: 0 | 1 | 2;
  name: string;
  status: string;
  planStart: string;
  planEnd: string;
  cells: ReadonlyArray<{ kind: GanttCellKind; symbol: GanttSymbol }>;
};

// Compact notation: plan "." none, "b" baseline, "1" first revision, "2" later revision;
// symbols "." none, "#" running, "v" done.
function row(
  id: string,
  depth: GanttRow["depth"],
  name: string,
  status: string,
  planStart: string,
  planEnd: string,
  plan: string,
  symbols: string,
): GanttRow {
  const kindOf: Record<string, GanttCellKind> = {
    ".": "none",
    b: "base",
    "1": "rev1",
    "2": "rev2",
  };
  const symbolOf: Record<string, GanttSymbol> = { ".": null, "#": "#", v: "✓" };
  return {
    id,
    depth,
    name,
    status,
    planStart,
    planEnd,
    cells: [...plan].map((char, index) => ({
      kind: kindOf[char] ?? "none",
      symbol: symbolOf[symbols[index] ?? "."] ?? null,
    })),
  };
}

export const GANTT_FIRST_MONDAY = "2026-08-03";
export const GANTT_CURRENT_WEEK = 8;

export const SAMPLE_GANTT: readonly GanttRow[] = [
  row(
    "p",
    0,
    "Normalisasi kanal blok A",
    "Proyek: Pengadaan",
    "2026-08-03",
    "2026-12-19",
    "bbbbbbbbbbbbbbbbbbbb",
    "....................",
  ),
  row(
    "w1",
    1,
    "Pekerjaan 1 · Galian kanal (tender)",
    "Bobot 60,00%",
    "2026-08-03",
    "2026-12-19",
    "bbbbbbbbbbbbbbbbbbbb",
    "....................",
  ),
  row(
    "w1-t1",
    2,
    "Tender #1",
    "Tender #1: Batal",
    "2026-08-03",
    "2026-08-29",
    "bbbb................",
    "##..................",
  ),
  row(
    "w1-t2",
    2,
    "Tender #2",
    "Tender #2: Berjalan",
    "2026-08-31",
    "2026-10-10",
    "....bbbb11..........",
    "....####............",
  ),
  row(
    "w1-f",
    2,
    "Fisik",
    "Fisik: Belum mulai",
    "2026-10-05",
    "2026-12-19",
    ".........bbbbbbbbb12",
    "....................",
  ),
  row(
    "w1-pk",
    2,
    "Paket · Semen dan besi",
    "Paket: Produksi",
    "2026-08-31",
    "2026-10-24",
    "....bbbbbbbb........",
    "....####............",
  ),
  row(
    "w2",
    1,
    "Pekerjaan 2 · Pipa outlet (pembelian)",
    "Bobot 40,00%",
    "2026-08-10",
    "2026-10-03",
    ".bbbbbbbb...........",
    "....................",
  ),
  row(
    "w2-pk",
    2,
    "Paket · Pipa HDPE",
    "Paket: Selesai",
    "2026-08-10",
    "2026-10-03",
    ".bbbbbbbb...........",
    ".######v............",
  ),
];
