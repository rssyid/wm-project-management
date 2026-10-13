import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { MutationOnly } from "@/prototype/role";
import { ProjectTable } from "@/prototype/project-table";
import { SAMPLE_PROJECTS } from "@/prototype/sample-data";

export default function ProjectListPage() {
  return (
    <>
      <PageHeader
        title="Proyek"
        actions={
          <MutationOnly>
            <Button>
              <Plus aria-hidden="true" />
              Buat proyek
            </Button>
          </MutationOnly>
        }
      />
      <ProjectTable projects={SAMPLE_PROJECTS} caption="Daftar proyek" />
    </>
  );
}
