"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useApp } from "@/contexts/app-context";

export function BreadcrumbNav() {
  const { selectedTarget, selectedBucket, view, setView, selectBucket } = useApp();

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {selectedTarget ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={() => {
                  selectBucket(null);
                  setView("buckets");
                }}
              >
                {selectedTarget.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {view === "buckets" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Buckets</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {view === "sync-profiles" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Sync Profiles</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {view === "objects" && selectedBucket && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => {
                      selectBucket(null);
                      setView("buckets");
                    }}
                  >
                    Buckets
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{selectedBucket}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>No target selected</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
