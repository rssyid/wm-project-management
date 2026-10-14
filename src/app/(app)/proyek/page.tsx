import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { MutationsOnly } from "@/components/auth/mutations-only";
import { ProjectTable } from "@/prototype/project-table";
import { SAMPLE_PROJECTS } from "@/prototype/sample-data";

export default function ProjectListPage() {
  return (
    <>
      <PageHeader
        title="Proyek"
        actions={
          <MutationsOnly>
            <Button>
              <Plus aria-hidden="true" />
              Buat proyek
            </Button>
          </MutationsOnly>
        }
      />
      <ProjectTable projects={SAMPLE_PROJECTS} caption="Daftar proyek" />
    </>
  );
}
