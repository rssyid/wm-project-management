"use client";

// D-21: prototype-only role simulation (no auth until F1). Stored in a cookie and read on the
// client so pages stay static. Deleted with the rest of src/prototype before F2.
import { Check, ChevronDown } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES, ROLE_LABEL, isRole, type Role } from "@/shared/role";

export const PROTOTYPE_ROLE_COOKIE = "wm_prototype_role";
const DEFAULT_ROLE: Role = "WM_HO_SPECIALIST";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Role {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${PROTOTYPE_ROLE_COOKIE}=([^;]+)`),
  );
  const value = match?.[1];
  return isRole(value) ? value : DEFAULT_ROLE;
}

function getServerSnapshot(): Role {
  return DEFAULT_ROLE;
}

function setPrototypeRole(role: Role) {
  document.cookie = `${PROTOTYPE_ROLE_COOKIE}=${role}; path=/; max-age=2592000; samesite=lax`;
  listeners.forEach((listener) => listener());
}

export function usePrototypeRole(): Role {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** docs/05 §1: viewers see the same screens without action buttons. */
export function MutationOnly({ children }: { children: ReactNode }) {
  return usePrototypeRole() === "MANAGEMENT_VIEWER" ? null : children;
}

export function RoleSwitcher() {
  const role = usePrototypeRole();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Peran prototipe: ${ROLE_LABEL[role]}. Ganti peran`}
        >
          <span className="max-w-[9rem] truncate">{ROLE_LABEL[role]}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-medium text-ink-muted">
          Peran prototipe (tanpa login)
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={role}
          onValueChange={(value) => {
            if (isRole(value)) setPrototypeRole(value);
          }}
        >
          {ROLES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {ROLE_LABEL[option]}
              {option === role ? (
                <Check aria-hidden="true" className="ml-auto" />
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
