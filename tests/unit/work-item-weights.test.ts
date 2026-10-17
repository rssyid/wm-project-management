import { describe, expect, it } from "vitest";

import {
  validateProjectWeights,
  validateWorkItemWeights,
} from "@/domain/work-item/weights";
import { DomainError } from "@/shared/errors";

describe("AC-31 bobot Pekerjaan tepat 100,00", () => {
  it("menolak total bobot Pekerjaan selain 100,00", () => {
    expect(() =>
      validateProjectWeights({
        version: 1,
        weights: [
          { workItemId: "a", projectWeightPct: "70.00" },
          { workItemId: "b", projectWeightPct: "20.00" },
        ],
      }),
    ).toThrowError(DomainError);
  });

  it("terima total bobot Pekerjaan tepat 100,00", () => {
    expect(() =>
      validateProjectWeights({
        version: 1,
        weights: [
          { workItemId: "a", projectWeightPct: "60.00" },
          { workItemId: "b", projectWeightPct: "40.00" },
        ],
      }),
    ).not.toThrow();
  });
});

describe("AC-31 bobot fisik dan material tepat 100 per Pekerjaan", () => {
  it("menolak fisik + material selain 100,00", () => {
    expect(() =>
      validateWorkItemWeights({
        version: 1,
        physicalWeightPct: "70.00",
        materialWeightPct: "20.00",
      }),
    ).toThrowError(DomainError);
  });

  it("terima fisik + material = 100,00", () => {
    expect(() =>
      validateWorkItemWeights({
        version: 1,
        physicalWeightPct: "70.00",
        materialWeightPct: "30.00",
      }),
    ).not.toThrow();
  });

  it("PURCHASE 0/100 valid", () => {
    expect(() =>
      validateWorkItemWeights({
        version: 1,
        physicalWeightPct: "0.00",
        materialWeightPct: "100.00",
      }),
    ).not.toThrow();
  });
});
