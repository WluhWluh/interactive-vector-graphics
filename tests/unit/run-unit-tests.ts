import { runAssetCapabilityUnitTests } from "./assets-capabilities.test";
import { runDocumentMigrationUnitTests } from "./document-migration.test";
import { runPrefabPosePropertyUnitTests } from "./prefab-pose-properties.test";
import { runViewMorphBillboardRendererUnitTests } from "./view-morph-billboard-renderer.test";
import { runViewMorphProfileUnitTests } from "./view-morph-profile.test";

runAssetCapabilityUnitTests();
runPrefabPosePropertyUnitTests();
runDocumentMigrationUnitTests();
runViewMorphProfileUnitTests();
runViewMorphBillboardRendererUnitTests();
