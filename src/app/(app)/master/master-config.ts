import type { MasterType } from "@/shared/location";

/**
 * Deskripsi kolom dan form per master (docs/05 §10). Satu komponen tabel dan satu panel form
 * memakai deskripsi ini; field yang benar-benar berbeda per tipe dideklarasikan di sini.
 */
export type ColumnConfig = {
  key: string;
  header: string;
  /** Sumber nilai pada baris API: `name`, `company.name`, `defaultUnit.name`, `version`, … */
  source: string;
  numeric?: boolean;
};

export type OptionSource =
  | "ops"
  | "regions"
  | "companies"
  | "wilayah"
  | "estates"
  | "units"
  | "vendorTypes";

export type FieldConfig = {
  name: string;
  label: string;
  kind: "text" | "number" | "decimal" | "select";
  required?: boolean;
  options?: OptionSource;
  hint?: string;
};

export const MASTER_COLUMNS: Record<MasterType, ColumnConfig[]> = {
  regions: [
    { key: "code", header: "Kode", source: "code" },
    { key: "name", header: "Nama", source: "name" },
    { key: "ops", header: "Wilayah kerja", source: "ops" },
    { key: "order", header: "Urutan", source: "order", numeric: true },
    { key: "active", header: "Status", source: "isActive" },
  ],
  wilayah: [
    { key: "code", header: "Kode", source: "region.code" },
    { key: "name", header: "Nama", source: "name" },
    { key: "region", header: "Region", source: "region.name" },
    { key: "order", header: "Urutan", source: "order", numeric: true },
    { key: "active", header: "Status", source: "isActive" },
  ],
  companies: [
    { key: "code", header: "Kode", source: "code" },
    { key: "name", header: "Nama", source: "name" },
    {
      key: "estates",
      header: "Estate",
      source: "_count.estates",
      numeric: true,
    },
    { key: "order", header: "Urutan", source: "order", numeric: true },
    { key: "active", header: "Status", source: "isActive" },
  ],
  estates: [
    { key: "code", header: "Kode", source: "code" },
    { key: "name", header: "Nama", source: "name" },
    { key: "company", header: "Company", source: "company.name" },
    { key: "wilayah", header: "Wilayah", source: "wilayah.name" },
    { key: "region", header: "Region", source: "wilayah.region.name" },
    { key: "order", header: "Urutan", source: "order", numeric: true },
    { key: "active", header: "Status", source: "isActive" },
  ],
  blocks: [
    { key: "blockCode", header: "Kode block", source: "blockCode" },
    { key: "name", header: "Nama", source: "name" },
    { key: "estate", header: "Estate", source: "estate.name" },
    {
      key: "plantingYear",
      header: "Tahun tanam",
      source: "plantingYear",
      numeric: true,
    },
    { key: "area", header: "Luas (ha)", source: "areaHectares", numeric: true },
    { key: "active", header: "Status", source: "isActive" },
  ],
  vendors: [
    { key: "name", header: "Nama", source: "name" },
    { key: "type", header: "Jenis", source: "type" },
    { key: "phone", header: "Telepon", source: "phone" },
    { key: "spk", header: "SPK", source: "_count.spks", numeric: true },
    { key: "complete", header: "Lengkap", source: "isComplete" },
    { key: "active", header: "Status", source: "isActive" },
  ],
  units: [
    { key: "code", header: "Kode", source: "code" },
    { key: "name", header: "Nama", source: "name" },
    { key: "active", header: "Status", source: "isActive" },
  ],
  "project-categories": [
    { key: "code", header: "Kode", source: "code" },
    { key: "name", header: "Nama", source: "name" },
    {
      key: "projects",
      header: "Proyek",
      source: "_count.projects",
      numeric: true,
    },
    { key: "order", header: "Urutan", source: "order", numeric: true },
    { key: "active", header: "Status", source: "isActive" },
  ],
  materials: [
    { key: "name", header: "Nama", source: "name" },
    { key: "unit", header: "Satuan", source: "defaultUnit.name" },
    { key: "code", header: "Kode", source: "code" },
    { key: "complete", header: "Lengkap", source: "isComplete" },
    { key: "active", header: "Status", source: "isActive" },
  ],
  "heavy-equipment-types": [
    { key: "name", header: "Nama", source: "name" },
    { key: "active", header: "Status", source: "isActive" },
  ],
  "approval-positions": [
    { key: "code", header: "Kode", source: "code" },
    { key: "name", header: "Nama", source: "name" },
    { key: "rank", header: "Peringkat", source: "rank", numeric: true },
    { key: "active", header: "Status", source: "isActive" },
  ],
};

export const MASTER_FIELDS: Record<MasterType, FieldConfig[]> = {
  regions: [
    { name: "code", label: "Kode", kind: "text", required: true },
    { name: "name", label: "Nama", kind: "text", required: true },
    {
      name: "ops",
      label: "Wilayah kerja",
      kind: "select",
      required: true,
      options: "ops",
    },
    { name: "order", label: "Urutan", kind: "number" },
  ],
  wilayah: [
    {
      name: "regionId",
      label: "Region",
      kind: "select",
      required: true,
      options: "regions",
    },
    { name: "name", label: "Nama", kind: "text", required: true },
    { name: "order", label: "Urutan", kind: "number" },
  ],
  companies: [
    { name: "code", label: "Kode", kind: "text", required: true },
    { name: "name", label: "Nama", kind: "text", required: true },
    { name: "order", label: "Urutan", kind: "number" },
  ],
  estates: [
    {
      name: "companyId",
      label: "Company",
      kind: "select",
      required: true,
      options: "companies",
    },
    {
      name: "wilayahId",
      label: "Wilayah",
      kind: "select",
      required: true,
      options: "wilayah",
    },
    { name: "code", label: "Kode", kind: "text", required: true },
    { name: "name", label: "Nama", kind: "text", required: true },
    { name: "estateNew", label: "Kode estate baru", kind: "text" },
    { name: "legacyCode", label: "Kode lama", kind: "text" },
    { name: "order", label: "Urutan", kind: "number" },
  ],
  blocks: [
    {
      name: "estateId",
      label: "Estate",
      kind: "select",
      required: true,
      options: "estates",
    },
    { name: "blockCode", label: "Kode block", kind: "text", required: true },
    { name: "name", label: "Nama", kind: "text", required: true },
    { name: "plantingYear", label: "Tahun tanam", kind: "number" },
    {
      name: "areaHectares",
      label: "Luas (ha)",
      kind: "decimal",
      hint: "Angka dengan maksimal 2 desimal.",
    },
  ],
  vendors: [
    { name: "name", label: "Nama", kind: "text", required: true },
    {
      name: "type",
      label: "Jenis",
      kind: "select",
      required: true,
      options: "vendorTypes",
    },
    { name: "contactName", label: "Nama kontak", kind: "text" },
    { name: "phone", label: "Telepon", kind: "text" },
    { name: "email", label: "Email", kind: "text" },
    { name: "npwp", label: "NPWP", kind: "text" },
    { name: "address", label: "Alamat", kind: "text" },
  ],
  units: [
    { name: "code", label: "Kode", kind: "text", required: true },
    { name: "name", label: "Nama", kind: "text", required: true },
  ],
  "project-categories": [
    { name: "code", label: "Kode", kind: "text", required: true },
    { name: "name", label: "Nama", kind: "text", required: true },
    { name: "order", label: "Urutan", kind: "number" },
  ],
  materials: [
    { name: "name", label: "Nama", kind: "text", required: true },
    {
      name: "defaultUnitId",
      label: "Satuan",
      kind: "select",
      required: true,
      options: "units",
    },
    { name: "code", label: "Kode", kind: "text" },
  ],
  "heavy-equipment-types": [
    { name: "name", label: "Nama", kind: "text", required: true },
  ],
  "approval-positions": [
    { name: "code", label: "Kode", kind: "text", required: true },
    { name: "name", label: "Nama", kind: "text", required: true },
    { name: "rank", label: "Peringkat", kind: "number", required: true },
  ],
};

export const MASTER_GROUPS: { title: string; types: MasterType[] }[] = [
  {
    title: "Lokasi",
    types: ["regions", "wilayah", "companies", "estates", "blocks"],
  },
  {
    title: "Katalog dan satuan",
    types: ["vendors", "units", "materials", "heavy-equipment-types"],
  },
  { title: "Jabatan", types: ["approval-positions", "project-categories"] },
];

/** docs/04 §2: kode dan nama urut untuk daftar. */
export const MASTER_ORDER: MasterType[] = MASTER_GROUPS.flatMap(
  (group) => group.types,
);

export const MASTER_LABEL: Record<MasterType, string> = {
  regions: "Region",
  wilayah: "Wilayah",
  companies: "Company",
  estates: "Estate",
  blocks: "Block",
  vendors: "Vendor",
  units: "Satuan",
  materials: "Material",
  "heavy-equipment-types": "Jenis alat berat",
  "approval-positions": "Jabatan approver",
  "project-categories": "Kategori proyek",
};

/** Master dengan filter lokasi berantai (docs/04 §2). */
export const LOCATION_TYPES: MasterType[] = ["wilayah", "estates", "blocks"];

/** Master yang punya kolom isComplete (AC-60: dipakai untuk tombol nonaktifkan, bukan hapus). */
export function hasCompleteFlag(type: MasterType): boolean {
  return type === "vendors" || type === "materials";
}
