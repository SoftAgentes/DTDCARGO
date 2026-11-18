"""MCP stdio adapter. Contains no credentials and exposes only five task tools."""
import json
import os
import socket
import sys
from bridge import TOOLS, MAX_BYTES

def invoke(name,args):
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as sock:
        sock.settimeout(50)
        sock.connect(os.environ.get('DTD_ALFRED_SOCKET','/run/dtd-alfred/bridge.sock'))
        sock.sendall(json.dumps({'name':name,'arguments':args},ensure_ascii=False).encode()+b'\n')
        with sock.makefile('rb') as stream:
            return json.loads(stream.readline(250000))

def main():
    for line in sys.stdin:
        request={}
        try:
            if len(line.encode())>MAX_BYTES:raise ValueError('Solicitud demasiado grande')
            request=json.loads(line)
            method=request.get('method');params=request.get('params') or {}
            if 'id' not in request:continue
            if method=='initialize':
                result={'protocolVersion':params.get('protocolVersion','2024-11-05'),'capabilities':{'tools':{}},'serverInfo':{'name':'dtd-alfred','version':'1.0.0'}}
            elif method=='ping':result={}
            elif method=='tools/list':result={'tools':TOOLS}
            elif method=='tools/call':
                output=invoke(params.get('name'),params.get('arguments',{}))
                result={'content':[{'type':'text','text':json.dumps(output.get('result') if output.get('ok') else {'error':output.get('error')},ensure_ascii=False)}],'isError':not output.get('ok')}
            else:
                print(json.dumps({'jsonrpc':'2.0','id':request['id'],'error':{'code':-32601,'message':'Metodo no disponible'}}),flush=True);continue
            response={'jsonrpc':'2.0','id':request['id'],'result':result}
        except Exception:
            response={'jsonrpc':'2.0','id':request.get('id'),'error':{'code':-32603,'message':'Puente no disponible. No afirmar que el encargo fue entregado; consultar la cola al recuperar conexion.'}}
        print(json.dumps(response,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
