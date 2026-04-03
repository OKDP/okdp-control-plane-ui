export interface SparkAppRequest {
    name: string;
    type: 'Java' | 'Scala' | 'Python' | 'R';
    mode: string;
    image: string;
    mainClass?: string;
    mainApplicationFile?: string;
    arguments?: string[];
    sparkVersion?: string;
    driverCores?: number;
    driverMemory?: string;
    executorInstances?: number;
    executorCores?: number;
    executorMemory?: string;
    sparkConf?: Record<string, string>;
}

export interface SparkAppYAMLRequest {
    yaml: string;
}

export interface SparkAppInstance {
    name: string;
    type: string;
    mode: string;
    image: string;
    status: string;
    errorMessage?: string;
    driverPodName?: string;
    createdAt?: string;
    completedAt?: string;
    executors?: Record<string, string>;
}

export interface SparkAppUpdateRequest {
    image?: string;
    mainClass?: string;
    mainApplicationFile?: string;
    arguments?: string[];
    driverCores?: number;
    driverMemory?: string;
    executorInstances?: number;
    executorCores?: number;
    executorMemory?: string;
    sparkConf?: Record<string, string>;
}

export interface SparkUIInfo {
    serviceName: string;
    uiAddress: string;
    historyServerUrl: string;
    available: boolean;
}

export interface SparkAppEvent {
    type: 'ADDED' | 'MODIFIED' | 'DELETED';
    object: SparkAppInstance;
}

export interface SparkConfig {
    image: SparkConfigImage;
    spark: SparkConfigSpark;
}

export interface SparkConfigImage {
    registry: string;
    repository: string;
    tag: string;
}

export interface SparkConfigSpark {
    defaultVersion: string;
    images: SparkImage[];
    defaults: SparkDefaults;
}

export interface SparkImage {
    label: string;
    image: string;
}

export interface SparkDefaults {
    driver: ResourceDefaults;
    executor: ExecutorDefaults;
}

export interface ResourceDefaults {
    cores: number;
    memory: string;
}

export interface ExecutorDefaults extends ResourceDefaults {
    instances: number;
}
