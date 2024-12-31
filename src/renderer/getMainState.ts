import {
  IpcChannel,
  type AnyState,
  type IpcRendererMethods,
} from "../common/types.js";

export async function getMainState<S extends AnyState = AnyState>(
  ipcRenderer: IpcRendererMethods,
): Promise<S> {
  const result = await ipcRenderer.invoke(IpcChannel.ForStateAsync);

  return result as S;
}

export function getMainStateSync<S extends AnyState = AnyState>(
  ipcRenderer: IpcRendererMethods,
): S | undefined {
  return ipcRenderer.sendSync(IpcChannel.ForStateSync);
}
