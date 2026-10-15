import {
  ProjectForm,
  type FormCompany,
} from "@/components/project/project-form";
import { prisma } from "@/infra/db";

/** docs/03 §3: Estate sebuah Company dipakai apa adanya supaya form tidak perlu request tambahan. */
export default async function NewProjectPage() {
  const [regions, categories, pics, estates] = await Promise.all([
    prisma.region.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.projectCategory.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.estate.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        companyId: true,
        blocks: { select: { id: true, blockCode: true, name: true } },
        wilayah: { select: { regionId: true } },
      },
    }),
  ]);

  const companies: FormCompany[] = [];
  for (const company of await prisma.company.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, code: true, name: true },
  })) {
    companies.push({
      id: company.id,
      code: company.code,
      name: company.name,
      estates: estates
        .filter((estate) => estate.companyId === company.id)
        .map((estate) => ({
          id: estate.id,
          code: estate.code,
          name: estate.name,
          regionId: estate.wilayah.regionId,
          blocks: estate.blocks,
        })),
    });
  }

  return (
    <ProjectForm
      regions={regions}
      companies={companies}
      categories={categories}
      pics={pics}
    />
  );
}
