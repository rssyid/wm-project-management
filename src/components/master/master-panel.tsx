"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  MASTER_FIELDS,
  type FieldConfig,
} from "@/app/(app)/master/master-config";
import type { MasterListItem, OptionItem } from "@/app/(app)/master/row";
import { OPS, OPS_LABEL, type Ops, type MasterType } from "@/shared/location";

import { MASTER_SCHEMAS } from "./types";

type Props = {
  type: MasterType;
  row: MasterListItem | null;
  hasVersion: boolean;
  options: Record<string, OptionItem[]>;
  onClose: () => void;
  onSaved: () => void;
};

const VENDOR_TYPES = [
  { id: "EKSTERNAL", name: "Eksternal" },
  { id: "INTERNAL", name: "Internal" },
];

export function MasterPanel({
  type,
  row,
  hasVersion,
  options,
  onClose,
  onSaved,
}: Props) {
  const router = useRouter();
  const fields = MASTER_FIELDS[type];
  const schemas = MASTER_SCHEMAS[type];
  const schema = row ? schemas.update : schemas.create;

  const defaultValues = buildDefaults(fields, row);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  async function submit(values: Record<string, unknown>) {
    const payload = {
      ...values,
      ...(row?.version !== undefined ? { version: row.version } : {}),
    };
    const response = await fetch(
      `/api/master/${type}${row ? `/${row.id}` : ""}`,
      {
        method: row ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Data gagal disimpan.");
      return;
    }
    toast.success(row ? "Data diperbarui" : "Data ditambahkan");
    onSaved();
    router.refresh();
    onClose();
  }

  return (
    <aside
      aria-label={row ? "Ubah data" : "Tambah data"}
      className="w-full rounded-lg border bg-panel p-4 md:max-w-[420px] md:shrink-0"
    >
      <h2 className="mb-4 text-base font-semibold text-ink">
        {row ? "Ubah data" : "Tambah data"}
      </h2>

      <form
        onSubmit={handleSubmit(submit)}
        className="flex flex-col gap-4"
        noValidate
      >
        {fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            options={options}
            errors={errors}
            register={register}
            setValue={setValue}
            value={defaultValues[field.name]}
          />
        ))}

        {hasVersion && row ? (
          <p className="text-dense text-ink-muted">
            Disimpan dengan versi {row.version}. Perubahan oleh orang lain akan
            ditolak.
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
        </div>
      </form>
    </aside>
  );
}

function Field({
  field,
  options,
  errors,
  register,
  setValue,
  value,
}: {
  field: FieldConfig;
  options: Record<string, OptionItem[]>;
  errors: FieldErrors<Record<string, unknown>>;
  register: (name: string) => Record<string, unknown>;
  setValue: (name: string, value: string) => void;
  value: unknown;
}) {
  const error = errors[field.name]?.message;
  const list =
    field.options === "ops" ? opsOptions() : optionsFor(field, options);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={field.name}>
        {field.label}
        {field.required ? "" : " (opsional)"}
      </Label>
      {field.kind === "select" ? (
        <select
          id={field.name}
          defaultValue={
            value === undefined || value === null ? "" : String(value)
          }
          onChange={(event) => setValue(field.name, event.target.value)}
          aria-invalid={Boolean(error)}
          className="h-9 w-full rounded border bg-panel px-2 text-sm"
        >
          <option value="">Pilih {field.label.toLowerCase()}</option>
          {list.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={field.name}
          type={field.kind === "number" ? "number" : "text"}
          step={field.kind === "decimal" ? "0.01" : undefined}
          aria-invalid={Boolean(error)}
          {...register(field.name)}
        />
      )}
      {error ? (
        <p className="text-dense text-destructive">{error}</p>
      ) : field.hint ? (
        <p className="text-dense text-ink-muted">{field.hint}</p>
      ) : null}
    </div>
  );
}

function buildDefaults(
  fields: FieldConfig[],
  row: MasterListItem | null,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    const value = row ? row[field.name] : undefined;
    defaults[field.name] =
      value === null || value === undefined
        ? field.kind === "select"
          ? ""
          : undefined
        : value;
  }
  return defaults;
}

function opsOptions() {
  return OPS.map((ops) => ({ id: ops, name: OPS_LABEL[ops as Ops] }));
}

function optionsFor(field: FieldConfig, options: Record<string, OptionItem[]>) {
  switch (field.options) {
    case "vendorTypes":
      return VENDOR_TYPES;
    case "regions":
      return options.regions ?? [];
    case "companies":
      return options.companies ?? [];
    case "wilayah":
      return options.wilayah ?? [];
    case "estates":
      return options.estates ?? [];
    case "units":
      return options.units ?? [];
    default:
      return [];
  }
}
