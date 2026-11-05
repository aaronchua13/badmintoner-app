import { Modal } from "antd";
import { errorText } from "../state/model";
import { ActionResult } from "../state/model";

/** Run destructive work only after confirmation, retaining the dialog on failure. */
export function useConfirmation() {
  const [modal, holder] = Modal.useModal();
  const confirm = (
    title: string,
    content: string,
    okText: string,
    action: () => Promise<ActionResult>,
  ): Promise<ActionResult> =>
    new Promise((resolve) => {
      const dialog = modal.confirm({
        title,
        content,
        okText,
        cancelText: "Cancel",
        okButtonProps: { danger: true },
        focusable: { autoFocusButton: "cancel" },
        maskClosable: false,
        onCancel: () => resolve({ ok: false, error: "Cancelled" }),
        onOk: async () => {
          try {
            const result = await action();
            if (!result.ok) throw new Error(result.error);
            resolve(result);
          } catch (error) {
            dialog.update({
              content: (
                <>
                  <p>{content}</p>
                  <p role="alert">{errorText(error)}</p>
                </>
              ),
            });
            throw error;
          }
        },
      });
    });
  return { confirm, holder };
}
