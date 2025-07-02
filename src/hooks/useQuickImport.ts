import { useState, useCallback } from "preact/hooks";
import { apiFootballService } from "../services/apiFootballService";
import { matchImportService } from "../services/matchImportService";
import { teamMappingService } from "../services/teamMappingService";
import { ImportProgress } from "../types/apiFootball";

interface QuickImportResult {
  success: boolean;
  message: string;
  imported?: number;
  skipped?: number;
  errors?: string[];
}

export function useQuickImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const canQuickImport = useCallback((): { canImport: boolean; reason?: string } => {
    // Check if API is configured
    if (!apiFootballService.isConfigured()) {
      return { canImport: false, reason: "API-Football not configured" };
    }

    // Check if there are any configured leagues with mappings
    const config = apiFootballService.getConfig();
    if (!config || config.selectedLeagues.length === 0) {
      return { canImport: false, reason: "No leagues configured" };
    }

    // Check if there are team mappings for at least one league
    let hasAnyMappings = false;
    for (const leagueId of config.selectedLeagues) {
      const currentYear = new Date().getFullYear();
      const mappings = teamMappingService.getTeamMappings(leagueId, currentYear);
      if (mappings.length > 0) {
        hasAnyMappings = true;
        break;
      }
    }

    if (!hasAnyMappings) {
      return { canImport: false, reason: "No team mappings configured" };
    }

    return { canImport: true };
  }, []);

  const quickImport = useCallback(async (localLeagueId: string): Promise<QuickImportResult> => {
    const { canImport, reason } = canQuickImport();
    if (!canImport) {
      return { success: false, message: reason || "Cannot import" };
    }

    setIsImporting(true);
    setProgress(null);

    // Set up progress callback
    const progressCallback = (progress: ImportProgress) => {
      setProgress(progress);
    };
    matchImportService.onProgress(progressCallback);

    try {
      const config = apiFootballService.getConfig()!;
      const currentYear = new Date().getFullYear();
      
      let totalImported = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];

      // Import from each configured league that has team mappings
      for (const apiLeagueId of config.selectedLeagues) {
        const mappings = teamMappingService.getTeamMappings(apiLeagueId, currentYear);
        if (mappings.length === 0) continue;

        try {
          const result = await matchImportService.importMatches(
            apiLeagueId,
            currentYear,
            localLeagueId
          );
          
          totalImported += result.imported;
          totalSkipped += result.skipped;
          allErrors.push(...result.errors);
        } catch (error) {
          const errorMsg = `Failed to import from league ${apiLeagueId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
          allErrors.push(errorMsg);
        }
      }

      // Clean up progress callback
      matchImportService.removeProgressCallback(progressCallback);

      if (totalImported === 0 && allErrors.length > 0) {
        return {
          success: false,
          message: "Import failed",
          errors: allErrors
        };
      }

      return {
        success: true,
        message: `Import completed: ${totalImported} matches imported, ${totalSkipped} skipped`,
        imported: totalImported,
        skipped: totalSkipped,
        errors: allErrors.length > 0 ? allErrors : undefined
      };

    } catch (error) {
      matchImportService.removeProgressCallback(progressCallback);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Import failed",
        errors: [error instanceof Error ? error.message : "Unknown error"]
      };
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  }, [canQuickImport]);

  return {
    isImporting,
    progress,
    canQuickImport,
    quickImport
  };
}