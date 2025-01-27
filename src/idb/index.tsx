import { ReactNode } from "react";
import { IndexedDB, initDB } from "react-indexed-db-hook";

const config = {
  name: "tasks",
  version: 1,
  objectStoresMeta: [
    {
      store: "tasks",
      storeConfig: { keyPath: "id", autoIncrement: true },
      storeSchema: [
        { name: "name", keypath: "name", options: { unique: false } },
        {
          name: "durationInMinutes",
          keypath: "durationInMinutes",
          options: { unique: false },
        },
      ],
    },
  ],
};

type IDBProviderProps = {
  children: ReactNode;
};

export const IDBProvider = ({ children }: IDBProviderProps) => {
  initDB(config);
  return <IndexedDB {...config}>{children}</IndexedDB>;
};
