export function PageSkeleton() {
  return (
    <div class="space-y-6 max-w-4xl mx-auto">
      {/* Page title */}
      <div class="animate-pulse bg-base-300 h-8 w-48 rounded" />

      {/* Main card */}
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <div class="animate-pulse bg-base-300 h-6 w-32 rounded mb-4" />
          <div class="space-y-3">
            <div class="animate-pulse bg-base-300 h-4 w-full rounded" />
            <div class="animate-pulse bg-base-300 h-4 w-3/4 rounded" />
            <div class="animate-pulse bg-base-300 h-4 w-5/6 rounded" />
          </div>
        </div>
      </div>

      {/* Secondary card */}
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <div class="animate-pulse bg-base-300 h-6 w-40 rounded mb-4" />
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <div class="animate-pulse bg-base-300 h-4 w-full rounded" />
              <div class="animate-pulse bg-base-300 h-4 w-2/3 rounded" />
            </div>
            <div class="space-y-2">
              <div class="animate-pulse bg-base-300 h-4 w-full rounded" />
              <div class="animate-pulse bg-base-300 h-4 w-2/3 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* List items */}
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <div class="animate-pulse bg-base-300 h-6 w-36 rounded mb-4" />
          <div class="space-y-4">
            <div class="flex items-center gap-4">
              <div class="animate-pulse bg-base-300 h-10 w-10 rounded-full" />
              <div class="flex-1 space-y-2">
                <div class="animate-pulse bg-base-300 h-4 w-1/2 rounded" />
                <div class="animate-pulse bg-base-300 h-3 w-1/3 rounded" />
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="animate-pulse bg-base-300 h-10 w-10 rounded-full" />
              <div class="flex-1 space-y-2">
                <div class="animate-pulse bg-base-300 h-4 w-1/2 rounded" />
                <div class="animate-pulse bg-base-300 h-3 w-1/3 rounded" />
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="animate-pulse bg-base-300 h-10 w-10 rounded-full" />
              <div class="flex-1 space-y-2">
                <div class="animate-pulse bg-base-300 h-4 w-1/2 rounded" />
                <div class="animate-pulse bg-base-300 h-3 w-1/3 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
