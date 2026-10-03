import { createFileRoute } from "@tanstack/react-router";
import { EditorPortalFotos } from "@/modules/foto-express/portal/EditorPortalFotos";
import { META_FOTOS_PRIVADA } from "@/modules/foto-express/portal/meta";
export const Route=createFileRoute("/fotos/trabalhos/$trabalhoId/fotos/$itemId")({component:Pagina,head:()=>({meta:META_FOTOS_PRIVADA})});
function Pagina(){const{trabalhoId,itemId}=Route.useParams();return <EditorPortalFotos trabalhoId={trabalhoId} itemId={itemId}/>}