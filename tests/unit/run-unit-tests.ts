import { runAssetCapabilityUnitTests } from "./assets-capabilities.test";
import { runDocumentMigrationUnitTests } from "./document-migration.test";
import { runPrefabPosePropertyUnitTests } from "./prefab-pose-properties.test";

runAssetCapabilityUnitTests();
runPrefabPosePropertyUnitTests();
runDocumentMigrationUnitTests();
