import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onConfirmar: () => void | Promise<void>;
  children: ReactNode;
  titulo?: string;
  descricao?: string;
  rotuloConfirmar?: string;
}

/** Modal reutilizável de confirmação para qualquer exclusão do sistema. */
export function ConfirmarExclusao({
  onConfirmar,
  children,
  titulo = "Confirmar exclusão",
  descricao = "Tem certeza que deseja excluir este registro? Esta ação não poderá ser desfeita.",
  rotuloConfirmar = "Excluir",
}: Props) {
  const [aberto, setAberto] = useState(false);
  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }))}
            onClick={() => {
              void onConfirmar();
            }}
          >
            {rotuloConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}